'use strict'

const Server = require('./src')
global.TYPE = 'server'
const {createSwarm} = require('./test/utils')

let swarm
let server

function boot(done) {
  swarm = createSwarm((err, res) => {
    swarm = res[0]
    server = new Server({
      swarm,
      discoveryInterval: 1000,
      discoveryUpdateInterval: 0
    })
    console.log('WSStar on %s', swarm.peerInfo.multiaddrs.toArray().map(a => a.toString()).join(', '))
    done()
  }, false)
}

function stop(done) {
  swarm.stop(done)
}

module.exports = {
  hooks: {
    pre: boot,
    post: stop
  }
}
