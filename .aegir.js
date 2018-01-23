'use strict'

const Server = require('./src')
const {createSwarm} = require('./utils')

let swarm
let server

module.exports = {
  hooks: {
    pre: done => {
      swarm = createSwarm(true)
      server = new Server({
        swarm,
        discoveryInterval: 1000,
        discoveryUpdateInterval: 0
      })
      swarm.start(err => {
        if (err) return done(err)

      })
    }
  }
}
