'use strict'

const Hapi = require('hapi')
const path = require('path')
const epimetheus = require('epimetheus')
const merge = require('merge-recursive').recursive
const Inert = require('inert')

exports = module.exports

exports.start = (options, callback) => {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  const config = merge(Object.assign({}, require('./config')), Object.assign({}, options))
  const log = config.log

  const port = options.port || config.hapi.port
  const host = options.host || config.hapi.host

  const http = new Hapi.Server(Object.assign({
    port,
    host
  }, config.hapi.options))

  http.register(Inert)
    .then(() => http.start(), callback)
    .then(() => {
      log('rendezvous server has started on: ' + http.info.uri)

      http.peers = require('./routes')(config, http).peers

      http.route({
        method: 'GET',
        path: '/',
        handler: (request, reply) => reply.file(path.join(__dirname, 'index.html'), {
          confine: false
        })
      })

      callback(null, http)
    }, callback)

  if (config.metrics) epimetheus.instrument(http)

  return http
}
