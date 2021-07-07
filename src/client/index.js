// Client side code for the screen sharing

// socket endpoint
const socketEndpoint = '/';

// ice server configuration for the webRTC negotiation
const pcConfig = {
  iceServers: [{
    url: 'stun:stun.l.google.com:19302'
  }]
};

// Generate a unique string to identify this client (peer)
function uuid() {
  let d = new Date().getTime();
  
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); //use high-precision timer if available
  }
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// simplified logging to the console
function log(statement = '', variable = '') {
  console.log(statement, variable)
}

// return the connected socket
var socket = io()
socket.on('connect', () => { console.log(socket.id) })

// Peer functions
// This is our peer object and stores things 
// about this connection instance
const peer  = {
    isStarted: false,
    clientId: uuid(),
    connections: {
      video: null
    },
    elements: {
      video: document.querySelector('#remote-video')
    }
  }

  // A message from the server end of the connection
  function onMessage(message) {
    log("onMessage", message);
  
    // Is the peer started - if not start it
    if (peer.isStarted == false) {
      startPeerConnections();
    }
  
    // Check to see if the message is for us
    if (message.clientId != peer.clientId) {
      log('Different client, ignoring message');
      return;
    }
  
    // Make sure the message and peerType are valid and the peer is started
    if (message && message.peerType && peer.isStarted)
    {
      // Fetch the peer type object
      const pc = peer.connections[message.peerType];
  
      if (message.sdp && message.sdp.type == 'offer')
      {
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
          .then(() => {
            pc.createAnswer()
              .then(answer => {
                pc.setLocalDescription(answer);
                return Promise.resolve(answer);
              })
              .then(answer => {
                sendMessage({type: 'answer', answer}, message.peerType);
              })
              .catch(log);
          })
          .catch(log);
      }
  
      if (message.type == 'candidate') {
        pc.addIceCandidate(new RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate
        }))
      }  
    }
  }
  
  // functions to handle change events for the webRTC connection
  function handleVideoStateChange(event) {
      log('iceConnectionState:', peer.connections.video.iceConnectionState)
  }
  
  function handleVideoIceCandidate(iceCandidate) {
    handleIceCandidate(iceCandidate, 'video')
  }
  
  function handleIceCandidate(iceCandidate, type) {
    if (iceCandidate) {
      return sendMessage ({
        clientId: peer.clientId,
        type: 'candidate',
        label: iceCandidate.sdpMLineIndex,
        id: iceCandidate.sdpMid,
        peerType: type,
        candidate: iceCandidate.candidate
      })
    }
    log('Done sending candidates')
  }
  
  function handleVideoTrackAdded(event) {
    log('added video stream')
    peer.elements.video.srcObject = event.streams[0]
  }
  
  function handleVideoRemoveTrack(event) {
    log('Removed video stream')
    peer.elements.video.srcObject = null
  }
  
  function startPeerConnections() {
  
    peer.connections.video = new RTCPeerConnection(pcConfig)
    peer.connections.video.onicecandidate = handleVideoIceCandidate
    peer.connections.video.ontrack = handleVideoTrackAdded
    peer.connections.video.onremovetrack = handleVideoRemoveTrack
    peer.connections.video.oniceconnectionstatechange = handleVideoStateChange
 
    log('Connections created')
    peer.isStarted = true
  }
  
  function sendMessage(message, peerType = 'video') {
    message.clientId = peer.clientId
    message.peerType = peerType
    socket.emit('rtc-message', message)
  }
  
  function connect() {
    if (peer.isStarted == false)
      startPeerConnections()
  
    sendMessage({type:'join', clientId: peer.clientId})  
  }
  
  function disconnect() {
    sendMessage({type:'leave', clientId: peer.clientId})
  }

  // Event functions.  These track the mouse and other movements in the shared screen and send them
  // to the remote end to allow for control
  function sendEvent(type, data) {
    log('rtc-event', type, data);
    socket.emit('rtc-event', {type, data})
}

let width;
let height;

function MouseMoveEvent(event) {
    sendEvent('mousemove', {
        canvasHeight: height,
        canvasWidth: width,
        toggle: false,
        x: event.pageX - event.target.offsetLeft,
    })
}

function MouseDownEvent(event) {
    sendEvent('mousedown', {
        canvasHeight: height,
        canvasWidth: width,
        toggle: 'down',
        x: event.pageX - event.target.offsetLeft,
    })
}

function MouseUpEvent(event) {
    sendEvent('mouseup', {
        canvasHeight: height,
        canvasWidth: width,
        toggle: 'up',
        x: event.pageX - event.target.offsetLeft,
    })
}

function KeyboardEvent(event) {
    sendEvent('keydown', {
        keyCode: event.keyCode,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey
    })
}

function WheelEvent(event) {
    sendEvent('wheel', {
        deltaX: event.deltaX,
        deltaY: event.deltaY
    })
}

function ClickEvent(event) {
    sendEvent('click', {
        which: event.which,
        double: false
    })
}

function DblClickEvent(event) {
    sendEvent('dblclick', {
        which: event.which,
        double: true
    })
}

function addEvents() {

    canvas = document.querySelector('#capture');
    const rect = canvas.getBoundingClientRect();
    width = rect.width
    height = rect.height
 
    canvas.addEventListener('mousemove', MouseMoveEvent, false);
    canvas.addEventListener('mousedown', MouseDownEvent, false);
    canvas.addEventListener('mouseup', MouseUpEvent, false);
    canvas.addEventListener('keydown', KeyboardEvent, false);
    canvas.addEventListener('wheel', WheelEvent, false);
    canvas.addEventListener('click', ClickEvent, false);
    canvas.addEventListener('dblclick', DblClickEvent, false);
}

// Setup the sock and then connect and add the event listeners
socket.on('rtc-message', onMessage)
connect()
addEvents()
