// Establish a WebSocket connection to the server
const socket = new WebSocket("ws://localhost:3000/ws");

// Listen for messages from the server

//TODO: Handle the events from the socket
// needed some help with this section. Did some research

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "vote_update") {
    const poll = data.poll;
    const pollId = poll._id;
    const pollElement = document.getElementById(pollId);

    if (pollElement) {
      const options = pollElement.querySelectorAll(".poll-options li");
      options.forEach((optionElement) => {
        const optionAnswer = optionElement
          .querySelector("strong")
          .textContent.trim();
        const option = poll.options.find((opt) => opt.answer === optionAnswer);
        if (option) {
          optionElement.innerHTML = `${optionAnswer}: ${option.votes} votes`;
        }
      });
    }
  }

  if (data.type === "new_poll") {
    onNewPollAdded(data);
  }
});

// needed help on this whole page really

/**
 * Handles adding a new poll to the page when one is received from the server
 *
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(data) {
  //TODO: Fix this to add the new poll to the page

  const pollContainer = document.getElementById("polls");
  const newPoll = document.createElement("li");
  newPoll.classList.add("poll-container");

  const pollTitle = document.createElement("h3");
  pollTitle.textContent - data.poll.question;
  newPoll.appendChild(pollTitle);

  const pollForm = document.createElement("form");

  data.poll.options.forEach((option, index) => {
    const optionContainer = document.createElement("div");
    const optionLabel = document.createElement("label");
    optionLabel.textContent = option.answer;
    const optionInput = document.createElement("input");
    optionInput.type = "radio";
    optionInput.name = `poll-${data.poll._id}`;
    optionInput.value = index;

    optionContainer.appendChild(optionLabel);
    optionContainer.appendChild(optionInput);

    pollForm.appendChild(optionContainer);
  });

  //TODO: Add event listeners to each vote button. This code might not work, it depends how you structure your polls on the poll page. However, it's left as an example
  //      as to what you might want to do to get clicking the vote options to actually communicate with the server
  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Vote";
  pollForm.appendChild(submitButton);
  newPoll.querySelectorAll(".poll-form").forEach((pollForm) => {
    pollForm.addEventListener("submit", onVoteClicked);
  });
}

/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 *
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {
  if (!data.poll || !data.poll._id || !data.poll.options) {
    console.error("Unable to receive votes: ", data);
    return;
  }

  const pollId = data.poll._id;
  const updatedOptions = data.poll.options;

  const pollElement = document.getElementById(pollId);
  if (!pollElement) {
    console.error(`Poll with ID ${pollId} not found.`);
    return;
  }

  optionElement.forEach((optionElement) => {
    const optionAnswer = optionElement
      .querySelector("strong")
      .textContent.trim();
  });

  const updatedOption = updatedOptions.find(
    (opt) => opt.answer === optionAnswer
  );

  if (updatedOption) {
    optionElement.innerHTML = `${optionAnswer}: ${updatedOption.votes} votes`;
  } else {
    console.warn(`Option with answer "${optionAnswer}" not found.`);
  }
}

/**
 * Handles processing a user's vote when they click on an option to vote
 *
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
async function onVoteClicked(event) {
  //Note: This function only works if your structure for displaying polls on the page hasn't changed from the template. If you change the template, you'll likely need to change this too
  event.preventDefault();
  const formData = new FormData(event.target);

  const pollId = formData.get("poll-id");
  const selectedOption = formData.get("option");

  //TOOD: Tell the server the user voted

  try {
    const response = await fetch("/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pollId: pollId,
        optionIndex: selectedOption,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("The Vote was successful!");
      updatePollId(pollId, selectedOption);
    } else {
      console.error("Error: ", data.message);
    }
  } catch (error) {
    console.error("Error voting:", error);
  }
}

//Adds a listener to each existing poll to handle things when the user attempts to vote
document.querySelectorAll(".poll-form").forEach((pollForm) => {
  pollForm.addEventListener("submit", onVoteClicked);
});
