// --- Chatbot streaming integration ---
document.addEventListener('DOMContentLoaded', function() {
	const questionInput = document.getElementById('questionInput');

	// Check if the URL contains ?type=installation
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.get('type') === 'installation') {
	    // Focus the input initially
	    questionInput.focus();
	
	    // Keep focus on the input whenever the user interacts with the page
	    document.addEventListener('click', () => {
	        questionInput.focus();
	    });
	
	    document.addEventListener('keydown', (e) => {
	        if (e.target !== questionInput) {
	            questionInput.focus();
	        }
	    });
	}

	// --- Temporary memory for chat history ---
	const chatHistory = [];

	// Chat logic
	const chatInput = document.getElementById('questionInput');
	const askButton = document.getElementById('askButton');
	const introDiv = document.querySelector('.intro');
	const chatDiv = document.querySelector('.chat');
	// Helper to create a new chatMessages container for each interaction
	function createChatMessagesContainer() {
		const chat = document.querySelector('.chat');
		const container = document.createElement('div');
		container.className = 'chatMessages';
		chat.appendChild(container);
		return container;
	}

	// Helper to create a user message
	function appendUserMsg(container, text) {
		const userMsg = document.createElement('div');
		userMsg.className = 'userMsg';
		userMsg.innerHTML = `<p class="label">tu: </p><p class="input"></p>`;
		userMsg.querySelector('.input').textContent = text;
		container.appendChild(userMsg);

		// Add user message to chat history
		chatHistory.push({ role: 'user', text });
	}

	// Helper to create a bot message
	function createBotMsg(container) {
		const botMsg = document.createElement('div');
		botMsg.className = 'botMsg';
		botMsg.innerHTML = `<p class="label">Climino: </p><p class="input"></p>`;
		container.appendChild(botMsg);
		return botMsg;
	}

	let chatShown = false;
	function showChat() {
		if (!chatShown) {
			if (introDiv) introDiv.style.display = 'none';
			if (chatDiv) chatDiv.style.display = 'block';
			chatShown = true;
		}
	}

	async function sendMessage(inputText) {
		showChat();
		// Create a new chatMessages container for this interaction
		const chatMessages = createChatMessagesContainer();
		appendUserMsg(chatMessages, inputText);
		const botMsg = createBotMsg(chatMessages);
		const botInput = botMsg.querySelector('.input');
		botInput.innerHTML = `
		<span class="thinking">
			<span></span><span></span><span></span>
		</span>
		`;

		// Prepare chat history for context (last 10 exchanges, alternate user/assistant)
		const maxHistory = 10;
		const messages = [];
		// Only previous messages, not including the current input
		const prevHistory = chatHistory.slice(0, -1);
		const recentHistory = prevHistory.slice(-maxHistory);
		recentHistory.forEach(h => {
			if (h.role === 'user') {
				messages.push({ role: 'user', content: h.text });
			} else if (h.role === 'bot') {
				messages.push({ role: 'assistant', content: h.text });
			}
		});

		// Print the JSON being sent
		const gooeyBody = {
			integration_id: "ro7",
			input_prompt: inputText,
			messages: messages
		};
		console.log("Sending to Gooey:", JSON.stringify(gooeyBody, null, 2));

		// Start streaming
		let response = await fetch("https://api.gooey.ai/v3/integrations/stream/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(gooeyBody),
		});
		let sseUrl = response.headers.get("Location");
		if (!sseUrl) {
			botInput.textContent = 'Errore di connessione.';
			return;
		}
		let evtSource = new EventSource(sseUrl);
		let accumulatedText = '';
		evtSource.onmessage = (event) => {
			let data;
			try {
				data = JSON.parse(event.data);
				//console.log("Received SSE data:", data);
			} catch (e) {
				data = { type: 'partial', text: event.data };
			}
			if (data.text !== undefined) {
				accumulatedText += data.text;
				// Replace **text** with <strong>text</strong>
				let htmlText = accumulatedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
				// If <strong>bibliografia</strong> is present, wrap everything after it in a span.outputMini
				const strongBiblioRegex = /(<strong>\s*bibliografia\s*<\/strong>)/i;
				const match = htmlText.match(strongBiblioRegex);
				if (match) {
					const idx = htmlText.indexOf(match[0]);
					var before = htmlText.slice(0, idx + match[0].length);
					var after = htmlText.slice(idx + match[0].length);
					before = marked.parse(before);
					after = marked.parse(after);
					htmlText = before + '<span class="outputMini">' + after + '</span>';
				}
				botInput.innerHTML = htmlText;
			}
			if (data.type === "final_response") {
				evtSource.close();

				// Add bot message to chat history
				chatHistory.push({ role: 'bot', text: accumulatedText });
			}
		};
		evtSource.onerror = (event) => {
			botInput.textContent = accumulatedText || 'Errore di rete.';
			evtSource.close();
		};
	}

	// Event listeners
	function handleAsk() {
		const val = chatInput.value.trim();
		if (!val) return;
		chatInput.value = '';
		sendMessage(val);
	}
	askButton.addEventListener('click', handleAsk);
	chatInput.addEventListener('keydown', function(e) {
		if (e.key === 'Enter') handleAsk();
	});

	// --- Expose chatHistory for debugging (optional, remove in production) ---
	window._chatHistory = chatHistory;
});
