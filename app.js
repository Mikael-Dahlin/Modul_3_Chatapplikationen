// Immediately Invoked Function Expression (IIFE)
(function() {
    // Declare global scope variables.
    let dataConnection = null;
    let mediaConnection = null;
    let connectionLabel = "";

    // Declare variables for HTML elements.
    const myPeerIdEl = document.querySelector(".my-peer-id");
    const listPeersButtonEl = document.querySelector(".list-all-peers-button");
    const peersEl = document.querySelector(".peers");
    
    const messagesEl = document.querySelector(".messages");
    const newMessageEl = document.querySelector(".new-message");
    const sendButtonEl = document.querySelector(".send-new-message-button");
    
    const theirVideoContainer = document.querySelector(".video-container.them");
    const nameEl = theirVideoContainer.querySelector('.name');
    const startVideoButtonEl = theirVideoContainer.querySelector(".start");
    const stopVideoButtonEl = theirVideoContainer.querySelector(".stop");
    
    const theirVideoEl = theirVideoContainer.querySelector("video");
    const myVideoEl = document.querySelector(".video-container.me video");

    // Get own video stream.
    navigator.mediaDevices
        .getUserMedia({ audio: false, video: true })
        .then((stream) => {
            myVideoEl.muted = true;
            myVideoEl.srcObject = stream;
        }).catch(console.error);

    // Function for getting current time.
    const getTime = () => {
        const now = new Date();
        let timeString = "";
        if(now.getHours() < 10) timeString += "0";
        timeString += `${now.getHours()}:`;
        if(now.getMinutes() < 10) timeString += "0";
        timeString += `${now.getMinutes()}:`;
        if(now.getSeconds() < 10) timeString += "0";
        timeString += now.getSeconds();
        return timeString;
    }

    // Function for printing out messages.
    const printMessage = (text, who) => {
        const currentTime = getTime();
        let message = `${currentTime} - ${text}`;
        if(who === 'me') message = `${text} - ${currentTime}`;

        const messageEl = document.createElement('div');
        messageEl.innerHTML = `<div>${message}</div>`;
        messageEl.classList.add('message', who);
        messagesEl.append(messageEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };
    
    // Get peer id (hash) from url.
    const myPeerId = location.hash.slice(1);

    // Connect to Peer server.
    let peer = new Peer(myPeerId, {
        host: "glajan.com",
        port: 8443,
        path: "/myapp",
        secure: true,
        config: {
            iceServers: [
              { urls: ["stun:eu-turn7.xirsys.com"] },
              {
                username:
                  "1FOoA8xKVaXLjpEXov-qcWt37kFZol89r0FA_7Uu_bX89psvi8IjK3tmEPAHf8EeAAAAAF9NXWZnbGFqYW4=",
                credential: "83d7389e-ebc8-11ea-a8ee-0242ac140004",
                urls: [
                  "turn:eu-turn7.xirsys.com:80?transport=udp",
                  "turn:eu-turn7.xirsys.com:3478?transport=udp",
                  "turn:eu-turn7.xirsys.com:80?transport=tcp",
                  "turn:eu-turn7.xirsys.com:3478?transport=tcp",
                  "turns:eu-turn7.xirsys.com:443?transport=tcp",
                  "turns:eu-turn7.xirsys.com:5349?transport=tcp",
                ],
              },
            ],
          },
    });
      
    // Runs when a connection to the server is opened.
    peer.on('open', (id) => {
        myPeerIdEl.innerText = id;
    });

    // Log error message in console in case of error.
    peer.on('error', (errorMessage) => {
        console.error(errorMessage);
    });

    // Runs when another peer connects to you.
    peer.on('connection', (connection) => {
        // Close existing connection and set new connection.
        dataConnection && dataConnection.close();
        mediaConnection && mediaConnection.close();
        dataConnection = connection;
        
        // Refresh peer list to make sure a connected button is showing.
        const clickEvent = new MouseEvent('click');
        listPeersButtonEl.dispatchEvent(clickEvent);
    });

    // Event listener for incoming video call.
    peer.on('call', (incomingCall) => {
        mediaConnection && mediaConnection.close();

        // Change state on start/stop button
        startVideoButtonEl.classList.remove("active");
        stopVideoButtonEl.classList.add("active");
        
        // Answer incoming call.
        navigator.mediaDevices
        .getUserMedia({ audio: false, video: true })
        .then((myStream) => {
            incomingCall.answer(myStream);
            mediaConnection = incomingCall;

            mediaConnection.on('stream', (theirStream) => {
                theirVideoEl.muted = true;
                theirVideoEl.srcObject = theirStream;
            });
        
            mediaConnection.on('close', () => {
                theirVideoEl.srcObject = "";
                stopVideoButtonEl.classList.remove("active");
                startVideoButtonEl.classList.add("active");
            });
        }).catch(console.error);
    });

    // Event listener for the Refresh List button.
    listPeersButtonEl.addEventListener('click', () => {
        peersEl.innerHTML = "";

        peer.listAllPeers((peers) => {
            const peersList = document.createElement('ul');
            peers.filter((peerId) => peerId !== peer.id).forEach((peerId) => {
                const newPeerListEl = document.createElement('li');
                const newPeerButtonEl = document.createElement('button');
                newPeerButtonEl.innerHTML = peerId;
                newPeerButtonEl.classList.add('connect-button', `peerId-${peerId}`);
                newPeerListEl.appendChild(newPeerButtonEl);
                peersList.appendChild(newPeerListEl);
            });
            peersEl.appendChild(peersList);

            // Send custom event if there is a data connection.
            if(dataConnection) {
                const event = new CustomEvent('peer-changed', {detail: dataConnection.peer});
                document.dispatchEvent(event);
            };
        });
    });

    // Event listener for click peer button.
    peersEl.addEventListener("click", (event) => {
        if(!event.target.classList.contains("connect-button")) return;
        const theirPeerId = event.target.innerText;
        
        // Close existing connection and set new connection.
        dataConnection && dataConnection.close();
        mediaConnection && mediaConnection.close();
        dataConnection = peer.connect(theirPeerId);
        
        dataConnection.on('open', () => {
            // dispatch custom event with connected peer id.
            const event = new CustomEvent('peer-changed', { detail: theirPeerId });
            document.dispatchEvent(event);
        });
    });

    // Event listener for custom event 'peer-changed'.
    document.addEventListener('peer-changed', (event) => {
        const peerId = event.detail;

        // Get clicked button.
        const connectButtonEl = document.querySelector(`.connect-button.peerId-${peerId}`);

        // Remove class 'connected' from button.
        document.querySelectorAll('.connect-button.connected').forEach(button => button.classList.remove('connected'));

        // Add class 'connected' to clicked button.
        connectButtonEl && connectButtonEl.classList.add("connected");

        // Runs once per data connection.
        if(dataConnection.label !== connectionLabel){
            // Set dataconnection listeners and focus message input.
            newMessageEl.focus();
            
            dataConnection.on('data', (textMessage) => {
                printMessage(textMessage, 'them');
            });
            
            dataConnection.on('close', () => {
                dataConnection = null;
                nameEl.innerText = 'No one connected';
                connectButtonEl.classList.remove("connected");
                theirVideoContainer.classList.remove('connected');
                printMessage(`Connection with ${peerId} closed`, 'me');
            });

            // Show name and controls of connected peer.
            nameEl.innerText = peerId;
            theirVideoContainer.classList.add('connected');
            startVideoButtonEl.classList.add("active");
            stopVideoButtonEl.classList.remove("active");
            
            connectionLabel = dataConnection.label;
        };
    });

    // Send message to peer.
    const sendMessage = (event) => {
        if(!dataConnection) return;
        if(newMessageEl.value === "") return;

        if(event.type === 'click' || event.keyCode === 13){
            dataConnection.send(newMessageEl.value);
            printMessage(newMessageEl.value, 'me');

            // Clear text input field and set focus.
            newMessageEl.value = "";
            newMessageEl.focus();
        };
    };

    // Event listeners for "send".
    sendButtonEl.addEventListener('click', sendMessage);
    newMessageEl.addEventListener('keyup', sendMessage);

    // Event listener for click 'start video chat'.
    startVideoButtonEl.addEventListener('click', () => {
        startVideoButtonEl.classList.remove("active");
        stopVideoButtonEl.classList.add("active");

        // Send my video to peer
        navigator.mediaDevices
            .getUserMedia({ audio: false, video: true })
            .then((myStream) => {
                mediaConnection && mediaConnection.close();
                mediaConnection = peer.call(dataConnection.peer, myStream);

                mediaConnection.on('stream', (theirStream) => {
                    theirVideoEl.muted = true;
                    theirVideoEl.srcObject = theirStream;
                });
            
                mediaConnection.on('close', () => {
                    theirVideoEl.srcObject = "";
                    stopVideoButtonEl.classList.remove("active");
                    startVideoButtonEl.classList.add("active");
                });
            }).catch(console.error);
    });

    // Event listener for click 'Hang up'.
    stopVideoButtonEl.addEventListener('click', () => {
        stopVideoButtonEl.classList.remove("active");
        startVideoButtonEl.classList.add("active");
        mediaConnection && mediaConnection.close();
    });
})();
