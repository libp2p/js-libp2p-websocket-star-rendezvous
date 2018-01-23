'use strict'

const {createSwarm, serverMa} = require('./utils')

describe('listen', () => {
  let swarm
  let star
  before(done => createSwarm((err, res) => err ? done(err) : done(null, ([swarm, star] = res)), false))

  it('can listen on one server', done => {
    star.createListener().listen(serverMa, done)
  })

  after(done => swarm.stop(done))
})
