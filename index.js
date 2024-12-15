const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");

const PORT = 3000;
//TODO: Update this URI to match your own MongoDB setup
const MONGO_URI = "mongodb://localhost:27017/keyin_test";
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "voting-app-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// connect clients
let connectedClients = [];

// Mongooes outline

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", UserSchema);

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [
    {
      answer: { type: String, required: true },
      votes: { type: Number, default: 0 },
    },
  ],
});

const Poll = mongoose.model("Poll", PollSchema);

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

// should enable Websocket routes for real time communication
app.ws("/ws", (socket, request) => {
  connectedClients.push(socket);

  socket.on("message", async (message) => {
    const data = JSON.parse(message);
    if (data.type === "vote") {
      await onNewVote(data.pollId, data.selectedOption);
    }
  });

  socket.on("close", async (message) => {
    connectedClients = connectedClients.filter((client) => client !== socket);
  });
});

// gets and post routes
app.get("/", async (request, response) => {
  const pollCount = await Poll.countDocuments();
  if (request.session.user?.id) {
    return response.redirect("/authenticated");
  }

  response.render("index/unauthenticatedIndex", { pollCount });
});

app.get("/login", async (request, response) => {
  if (request.session.user?.id) {
    return response.redirect("/authenticated");
  }
  response.render("login", { errorMessage: null });
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const user = await User.findOne({ username, password });

  if (user) {
    request.session.user = { id: user.id, username: user.username }; // Store the user
    console.log("User logged in: ", request.session.user);
    return response.redirect("/authenticated");
  } else {
    return response.render("login", { errorMessage: "Invalid credentials" });
  }
});

app.get("/signup", async (request, response) => {
  if (request.session.user?.id) {
    return response.redirect("/authenticated"); // all these mean return to authenticated page
  }

  return response.render("signup", { errorMessage: null });
});

app.post("/signup", async (request, response) => {
  const { username, password } = request.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    response.redirect("/login");
  } catch (error) {
    response.render("signup", {
      errorMessage: "Error during login. Try again.",
    }); // validation
  }
});

// because the header.ejs requires a logout option, i added a post method for loggigng out.

app.post("/logout", (request, response) => {
  request.session.destroy(() => {
    console.log("User logged out!");
    response.redirect("/"); // ends your session and brings you to home page
  });
});

app.get("/authenticated", async (request, response) => {
  console.log("Session: ", request.session);
  console.log("User: ", request.session.user);
  if (!request.session.user) {
    return response.redirect("/login");
  }

  const polls = await Poll.find();

  response.render("authenticatedIndex", {
    user: request.session.user, // should pass 'user' so u can view nav links in header.ejs
    polls: polls || [],
  });

  //TODO: Fix the polls, this should contain all polls that are active. I'd recommend taking a look at the
  //authenticatedIndex template to see how it expects polls to be represented
});

app.get("/profile", async (request, response) => {
  if (!request.session.user) {
    return response.redirect("/login");
  }

  const username = request.session.user.username;
  const votedPolls = await Poll.find({ "options.votes": { $gt: 0 } });
  const votedCount = votedPolls.length;

  response.render("profile", { username, votedCount });
});

app.get("/createPoll", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }

  return response.render("createPoll", { errorMessage: null }); // added in an error message
});

// Poll creation
app.post("/createPoll", async (request, response) => {
  const { question, options } = request.body;

  try {
    const formattedOptions = Object.values(options).map((option) => ({
      answer: option,
      votes: 0,
    }));

    // calling the onCreateNewPoll function from bottom of page:
    const error = onCreateNewPoll(question, formattedOptions);
    if (error) {
      return response.render("createPoll", { errorMessage: error });
    }

    // essentially notify client of poll
    connectedClients.forEach((client) => {
      client.send(JSON.stringify({ type: "new_poll", poll: newPoll }));
    });

    response.redirect("/dashboard");
  } catch (error) {
    response.render("createPoll", { errorMessage: "Error creating poll." });
  }
});
//TODO: If an error occurs, what should we do?
// The code that was given, I no longer needed it bc I used Try and catch to handle the errors.
// The response.render line above brings you back to the createPoll page if any errors occur.

// Added method to display votes
app.post("/vote", async (request, response) => {
  const { pollId, optionIndex } = request.body;

  try {
    const poll = await Poll.findById(pollId);
    if (poll) {
      poll.options[optionIndex].votes += 1; // increases the votes number by 1
      await poll.save(); // then saves and updates

      connectedClients.forEach((client) => {
        client.send(
          JSON.stringify({
            type: "vote_update",
            poll: poll,
          })
        );
      });

      return response.status(200).send({ success: true });
    } // any erross that may occur
    response.status(404).send({ success: false, message: "Invalid Poll." });
  } catch (error) {
    response
      .status(500)
      .send({ success: false, message: "Error with voting." });
  }
});

mongoose
  .connect(MONGO_URI)
  .then(() =>
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    )
  )
  .catch((err) => console.error("MongoDB connection error:", err));

/**
 * Handles creating a new poll, based on the data provided to the server
 *
 * @param {string} question The question the poll is asking
 * @param {[answer: string, votes: number]} pollOptions The various answers the poll allows and how many votes each answer should start with
 * @returns {string?} An error message if an error occurs, or null if no error occurs.
 */
async function onCreateNewPoll(question, pollOptions) {
  try {
    //TODO: Save the new poll to MongoDB
    const newPoll = new Poll({ question, options: pollOptions });
    await newPoll.save();

    //TODO: Tell all connected sockets that a new poll was added
    connectedClients.forEach((client) => {
      client.send(JSON.stringify({ type: "new_poll", poll: newPoll }));
    });

    return null;
  } catch (error) {
    console.error(error);
    return "Error creating the poll, please try again";
  }
}
