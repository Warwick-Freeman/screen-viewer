const socketEndpoint = '/';

const pcConfig = {
  iceServers: [{
    url: 'stun:stun.l.google.com:19302'
  }]
};

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

function log(statement = '', variable = '') {
  console.log(statement, variable)
}

// return the connected socket
var socket = io()
socket.on('connect', () => { console.log(socket.id) })

//socket.connect(socketEndpoint)

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
  
  function onMessage(message) {
    log("onMessage", message);
  
    // Is the peer started
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
  
  function handleAudioStateChange(event) {
    log('Audio state change')  
  }

  function handleVideoStateChange(event) {
      log('iceConnectionState:', peer.connections.video.iceConnectionState)
  }
  
  function handleAudioIceCandidate(iceCandidate) {
    handleIceCandidate(iceCandidate, 'audio')
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
  
  function handleAudioTrackAdded(event) {
    log('added audio stream')
    peer.elements.audio.srcObject = event.streams[0]
  }
  
  function handleVideoTrackAdded(event) {
    log('added video stream')
    peer.elements.video.srcObject = event.streams[0]
  }
  
  function handleAudioRemoveTrack(event) {
    log('Removed audio stream')
    peer.elements.audio.srcObject = null
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

  

// Setup the sock and then connect and add the event listeners
socket.on('rtc-message', onMessage)
connect()
//addEvents()
