import Router from 'koa-router'
import { readDirStructure } from 'wrote'
import { resolve, relative, sep } from 'path'

let fsevents
try {
  fsevents = require('fsevents')
} catch (e) { /* ignore fsevents */ }

const filterJsx = route => /\.jsx?$/.test(route)

const removeExtension = (route) => {
  return `${route.replace(/\.jsx?$/, '')}`
}

const reducePaths = (acc, { route, fn }) => {
  return {
    ...acc,
    [route]: fn,
  }
}

const importRoute = (dir, file, defaultImports = false) => {
  const route = `/${removeExtension(file)}`
  const path = resolve(dir, file)
  const mod = require(path)
  const fn = defaultImports ? mod.default : mod
  fn._route = true
  return { route, fn }
}

const getName = (method, path) => `${method.toUpperCase()} ${path}`

/**
 *
 * @param {Object} routes
 * @param {string} method
 * @param {Router} router
 * @param {function} [getMiddleware]
 * @param {{string:[string]}} [aliases]
 * @returns {[string]} An array of routes.
 */
const addRoutes = (routes, method, router, getMiddleware, aliases = {}) => {
  const res = Object.keys(routes).reduce((acc, route) => {
    const fn = routes[route]
    const middleware = typeof getMiddleware == 'function' ? getMiddleware(fn) : [fn]
    const name = getName(method, route)
    router[method](name, route, ...middleware)

    const a = aliases[route] || []
    const al = a.map((alias) => {
      const aliasName = getName(method, alias)
      router[method](aliasName, alias, ...middleware)
      return alias
    })
    return { ...acc, [route]: al }
  }, {})
  return res
}

const readRoutes = async (dir, {
  filter = filterJsx,
  defaultImports = false,
} = {}) => {
  const { content: topLevel } = await readDirStructure(dir)
  const methods = Object.keys(topLevel).reduce((acc, method) => {
    const { type } = topLevel[method]
    if (type != 'Directory') return acc
    const { content: files } = topLevel[method]
    const modules = Object.keys(files)
      .filter(filter)
      .map(file => {
        return importRoute(resolve(dir, method), file, defaultImports)
      })

    const routes = modules.reduce(reducePaths, {})
    return {
      ...acc,
      [method]: routes,
    }
  }, {})
  return methods
}

/**
 * @typedef {Object} InitConfig
 * @property {function} [filter] A function used to filter files found in routes directory.
 * @property {boolean} [defaultImports=false] Whether routes are written with ES6 modules and export
 * a default function
 * @property {boolean} [watch=false] Automatically reload the route when the
 * module file gets updated (does not watch child dependencies).
 */

/**
 *
 * @param {string} dir Path to the routes folder
 * @param {Router} router Instance of koa-router
 * @param {InitConfig} param2
 */
const initRoutes = async (dir, router, {
  middleware = {},
  filter = filterJsx,
  defaultImports,
  aliases = {},
  watch = false,
} = {}) => {
  const methods = await readRoutes(dir, { filter, defaultImports })
  const res = Object.keys(methods).reduce((acc, method) => {
    const routes = methods[method]
    const getMiddleware = middleware[method]
    const methodAliases = aliases[method]
    const r = addRoutes(routes, method, router, getMiddleware, methodAliases)
    return {
      ...acc,
      [method]: r,
    }
  }, {})
  if (watch && fsevents) {
    watchRoutes(dir, router, defaultImports, aliases)
  }
  return res
}

const watchRoutes = (dir, router, defaultImports, aliases) => {
  const watcher = fsevents(dir)

  watcher.on('change', (path) => {
    const rel = relative(dir, path)
    const [method, file] = rel.split(sep)
    const route = `/${removeExtension(file)}`
    const name = getName(method, route)
    const layer = router.route(name)
    const fn = layer.stack.find(({ _route }) => _route == true)
    if (!fn) return
    const index = layer.stack.indexOf(fn)
    delete require.cache[path]
    const { fn: newFn } = importRoute(dir, rel, defaultImports)
    layer.stack[index] = newFn

    const a = aliases[method][route] || []
    const reloadedAliases = a.map((alias) => {
      const aliasName = getName(method, alias)
      const layer = router.route(aliasName)
      const fn = layer.stack.find(({ _route }) => _route == true)
      if (!fn) return
      const index = layer.stack.indexOf(fn)
      layer.stack[index] = newFn
      return aliasName
    })

    console.log('> hot reloaded %s (%s)', name, reloadedAliases.join(', '))
  })
  watcher.start()
  console.log('watching %s routes directory', dir)
}

module.exports = {
  initRoutes,
  readRoutes,
  addRoutes,
}

