const { desktopCapturer } = require('electron');
const  { removeAllPeers, removePeer, findPeer } = require( './peer-utils');

// general function to log debug messages to the console
function log(statement = '', variable = '') {
  console.log(statement, variable)
}

const height = window.screen.height;
const width = window.screen.width;

// create and connect the socket
const io = require('socket.io-client');
const endpoint = 'http://localhost:8888';
const socket = io(endpoint);

// client-side 
socket.on('connect', () => { console.log(socket.id) });

// set our message handler for all message of rtc type
socket.on('rtc-message', handleMessage);

// Now do the startup activities to get ready for the webRTC connection
boot();

// The cofiguration for our webRTC ice server - default to the google public one
const config = {
  iceServers: [{
    url: 'stun:stun.l.google.com:19302'
  }]
}

// setup our globals for the streams etc
let peers = [];
let localScreenStream = null;
let inputSources = null;

// Get the available video sources - note this is an async function so it returns a promise
async function getVideoSources() {
  inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });

  log('getVideoSources', inputSources);
}

// Get the video stream from the list of sources - also async and returns a promise
async function getVideoStream() {

  let i = 0;

  for (i = 0; i < inputSources.length ;i++) {

    let winProg = inputSources[i].name.slice(0,13);
    if (winProg == 'ProFusion EEG') {
      break;
    }
  }

  if (i == inputSources.length)
    i = 0;

  const sourceId = inputSources[i].id;
 
  const stream = await navigator.mediaDevices.getUserMedia(
    {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId
        }
      }
    }
  );

  if (stream) {
    log('videoStream', stream);
    localScreenStream = stream;
  }
}

async function getVideo() {

  let sourcePromise = getVideoSources();

  sourcePromise.then(
    function(value) {
      log('sourcePromise accepted', value);

      let streamPromise = getVideoStream();
      
      streamPromise.then(
        function(value) {
          log('streamPromise accepted', value);
        },
        function(error) {
          log('streamPromise rejected', error);
        }
      )
    },
    function(error) {
      log('sourcePromise rejected', error);
    }
  );
}

function boot() {
  getVideo();
}
  
  // handle messages from the client end 
function handleMessage(message) {
  const { clientId } = message;

  log("handleMessage", message);

  // This is the initial call the client makes
  if (message.type === 'join') {
    return initPeerConnections(clientId, localScreenStream);
  }

  const peer = findPeer(peers, clientId);
  const type = message.peerType || 'video';
  const pc = peer[type];

  if (message.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(message.sdp));

    pc.createAnswer()
      .then(handleSessionDescription.bind(peer, clientId))
      .catch(error)
  }

  // On answer - set the updated sdp for this peer
  if (message.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(message.answer));
  }

  if (message.type === 'candidate') {
    const iceCandidate = new RTCIceCandidate(message);

    pc.addIceCandidate(iceCandidate).catch(log('addIceCandidate error', error));
  }

  if (message.type === 'leave') {
    peers = removePeer(peers, clientId);
  }

  if (message.type === 'disconnect-all') {
    peers = removeAllPeers(peers);
  }
}

// send a message to the server for relay to the clients
function sendMessage(message) {
  log("sendMessage", message)
  socket.emit('rtc-message', message)
}


// Initalise the client peer connections
function initPeerConnections(clientId, screenStream) {

  const peer = createPeerConnections(clientId);

  peer.video.addStream(screenStream);

  peer.video.createOffer()
    .then(handleSessionDescription.bind(peer, 'video'))
    .catch(log)

  peers.push(peer);
  log('Peer added, peers: ', peers);
}
  
// This handles the ice candidate as part of the webRTC negotiations
function handleIceCandidate(event) {
  if (event.candidate) {
    return sendMessage({
      clientId: this.clientId,
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      peerType: 'video',
      candidate: event.candidate.candidate
    })
  }
  log('handleIceCandidate - end of candidates.')
}

// Handle the session description from the remote end
function handleSessionDescription(type, sdp) {
  log("handleSessionDescription", type, sdp);
  this[type].setLocalDescription(sdp);
  const message = { peerType: type, sdp: sdp, clientId: this.clientId }
  sendMessage(message);
}
  
// create the peer object and initialise it
function createPeerConnections(clientId) {
  const peer = {
    clientId,
    video: new RTCPeerConnection(config)
  };

  peer.video.onicecandidate = handleIceCandidate.bind(peer);
  return peer;
}

  