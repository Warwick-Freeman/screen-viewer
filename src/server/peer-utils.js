function removeAllPeers(peers) {
    if (peers.length) {
      peers.forEach(p => {
        if (p && p.peerConnection) {
          p.peerConnection.close()
        }
        p = null
      })
      console.log('Removed all peers')
      return []
    }
  }
  
  function removePeer(peers, clientId) {
    if (!clientId) return
    return peers.filter(p => p.clientId !== clientId)
  }
  
  function findPeer(peers, clientId) {
    if (!clientId) return
    return peers.find(peer => peer.clientId === clientId)
  }
  
  module.exports = {
    findPeer,
    removePeer,
    removeAllPeers
  }
  