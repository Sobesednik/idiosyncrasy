# idio

[![npm version](https://badge.fury.io/js/idio.svg)](https://badge.fury.io/js/idio)

```
yarn add -E idio
```

`idio` is a koa2-based web server with some pre-installed middleware and Mongo support out of the box. Its purpose is to be able to quickly create a server with basic functionality. It also supports automatic initialisation of routes from a given directory, and watching those routes for updates (with `idio-dev`). This means that the whole server does not need to restart when a single route changes.

## Example

```js
/* yarn example */
import idio from 'idio'
import config, { routesConfig } from './config'

(async () => {
  try {
    const { url } = await idio(config, routesConfig)
    console.log(url) // eslint-disable-line
  } catch ({ stack }) {
    console.log(stack) // eslint-disable-line
    process.exit(1)
  }
})()
```

```sh
http://localhost:5000
```

## `idio(config, routesConfig?)`

Idio accepts 2 arguments: the config and optional routes config to read routes from directories.

## Configuration

The server can be configured using the following structure.

| property    | default                    | description                                              |
|-------------|----------------------------|----------------------------------------------------------|
| databaseURL | mongodb:// localhost: 27017 | MongoDB connection string.                               |
| port        | 5000                       | Web server port.                                         |
| host        | 0.0.0.0                    | Web server host.                                         |
| autoConnect | true                       | Whether to automatically connect to the database server. |
| middleware  |                            | Middleware configuration.                                |

```js
import { resolve } from 'path'

const uploadDir = resolve(__dirname, 'upload')
const routesDir = resolve(__dirname, 'routes')

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/idio'
const PORT = process.env.PORT || 5000

export default {
  databaseURL: DATABASE_URL,
  port: PORT,
  middleware: {
    session: { keys: ['secret-key'] },
    multer: { config: { dest: uploadDir } },
    csrf: { },
    bodyparser: { },
    checkauth: { },
    logger: { use: true },
    koa2Jsx: { use: true, wireframe: true /*, bootstrap: true */ },
    // ---- custom middleware
    ip: {
      function(app, config) {
        return async (ctx, next) => {
          console.log(`${config.text}: ${ctx.request.ip}`)
          await next()
        }
      },
      config: { text: 'ip' },
      use: true,
    },
  },
}
```

### Middleware Configuration

`idio` can instantiate some known middleware shipped with it, as well as additionally specified middleware. Each `middleware` property accepts the following properties:

| property | description                                                                   | default |
|----------|-------------------------------------------------------------------------------|---------|
| use      | Whether to use this middleware for every request.                             | false   |
| config   | Configuration object expected by the middleware constructor.                  | {}      |
| ...props | Any additional specific properties (see individual middleware configuration). |         |

It is possible to pass multiple configurations as an array for a single type of middleware, if multiple instances of it need to be created (e.g., for `static`).

<!-- This might not work with routes initialisation when passing getMiddleware function. -->

#### session

[`koa-session`](https://github.com/koajs/session) for handling sessions.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| keys     | A set of keys to be installed in `app.keys` | -       | true     |
| _config_     | `koa-session` configuration | {}       | -     |

#### multer

[`koa-multer`](https://github.com/koa-modules/multer) for file uploads.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| config.dest     | An upload directory which will be created on start. | -       | true     |
| _config_     | `koa-multer` configuration | {}       | -     |

#### csrf

[`koa-csrf`](https://github.com/koajs/csrf) for prevention against CSRF attacks.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| _config_     | `koa-csrf` configuration | {}       | -     |

#### bodyparser

[`koa-bodyparser`](https://github.com/koajs/body-parser) to parse data sent to the server.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| _config_     | `koa-bodyparser` configuration | {}       | -     |

#### checkauth

A simple middleware which throws if `ctx.session.user` is not set.

#### logger

[`koa-logger`](https://github.com/koajs/logger) to log requests.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| _config_     | `koa-logger` configuration | {}       | -     |

#### compress

[`koa-compress`](https://github.com/koajs/compress) to apply compression.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| threshold     | Minimum response size in bytes to compress. | 1024       | -     |
| _config_     | `koa-compress` configuration | {}       | -     |

#### koa2Jsx

[`koa2-jsx`](https://github.com/artdecocode/koa2-jsx) to render JSX pages.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| wireframe     | Whether to use a default wireframe. | false       | -     |
| bootstrap     | Whether to include bootstrap (when using wireframe). | false       | -     |
| static     | Whether to use `staticNodeStreamRender` rather than `nodeStreamRender` from `react` package. It will strip `react`'s metadata required for hydration. Set to this to `false` when client-side `react` is also used. | true       | -     |
| pretty     | Return formatted HTML (as a string and not stream, therefore slower) | false       | -     |
| _config_     | `koa2-jsx` configuration | {}       | -     |

#### static

[`koa-static`](https://github.com/koajs/static) to serve static files.

| property | description                                 | default | required |
|----------|---------------------------------------------|---------|----------|
| root     | Root directory as a string or directories as an array of strings. | -       | true     |
| mount     | Path from which files will be served | `/`       | -     |
| maxage     | Controls caching time. | 0       | -     |
| _config_     | `koa-static` configuration | {}       | -     |

```js
import { resolve, dirname } from 'path'
import idio from 'idio'

const STATIC = resolve(__dirname, 'static')
const react = resolve(dirname(require.resolve('react')), 'umd')

(async () => {
  const { url } = await idio({
    middleware: {
      static: {
        use: true,
        root: ['static', react],
        mount: '/scripts',
        maxage: process.env.NODE_ENV == 'production' ?  1000 * 60 * 60 * 24 * 10 : 0,
      },
    },
  })
})
```

#### Custom Middleware

Other middleware can be passed as an object which has 3 properties:

- _function_ - constructor function (optional). It will receive the `app` and `config` arguments and should return a middleware function

```js
const middlewareConstructor = async (app, config) => {
  app.context.usingFunction = true

  return async(ctx, next) => {
    await next()
    if (config.debug) {
        console.error(ctx.usingFunction)
    }
  }
}
```

- _config_ - an object that will be passed to the middleware constructor.

```js
const config = {
  debug: process.env.NODE_DEBUG == 'idio',
}
```

- _use_ - whether to always use this middleware, which will perform `app.use()` after the constructor returned the middleware.

All together, setting up a custom middleware looks like this:

```js
await idio({
  middleware: {
    customMiddleware: {
      async function(app, config) {
        app.context.usingFunction = true

        return async(ctx, next) => {
          await next()
          if (config.debug) {
              console.error(ctx.usingFunction)
          }
        }
      },
      config: { debug: process.env.NODE_DEBUG == 'idio' },
      use: true,
    },
  },
})
```

## Router Configuration

In most cases, it is desirable to have a router for the application. `idio` provides a means to read files from a directory which is organised by methods (e.g., `routes/get`, `routes/post`). If the router configuration is passed to the `idio` function, the routes will be set up.

| property       | default                    | description                                                                                                                           |
|----------------|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| dir            | string                     | Path to the directory where routes are found. Must have `get`, `post`, _etc_ folders inside with files which export a default module. |
| middleware     | {}                         | A function which determines which middleware not installed with `use` is present for each method.                                     |
| filter         | `(s) => /\.jsx?$/.test(s)` | A function to filter included routes by filename.                                                                                     |
| defaultImports | true                       | Whether routes are exported with ES6 `export default`.                                                                                |
| aliases        | {}                         | A map of aliases.                                                                                                                     |

```js
export const routesConfig = {
  dir: routesDir,
  defaultImports: true,
  aliases: {
    get: {
      '/index': ['/'],
    },
  },
  middleware: {
    get: route => ['session', route],
    post: route => ['bodyparser', route],
  },
}
```

### middleware

`middleware` property determines the order and installed middleware for each method. Currently it is impossible to control the middleware for each individual route. The strings returned by this function are mapped to the middleware functions created during middleware set-up earlier using the keys from the `idio` config. All middleware specified with this method will be run after the middleware from app configuration with `use` property set to true.

### aliases

A map of aliases for each method, where keys are the routes, and values are arrays to which they should respond.

### Routes

Routes need to be written as `async` Koa middleware and exported as a default function.

```js
/* example/routes/index.js */
export default async (ctx) => {
  const n = ctx.session.views || 1
  ctx.session.views = n + 1
  ctx.body = `${n} views`
}
```

When not using modules, `defaultImports` should be set to false, otherwise no routes will be set up.

```js
/* example/routes/index.js */
const fn = async (ctx) => {
  const n = ctx.session.views || 1
  ctx.session.views = n + 1
  ctx.body = `${n} views`
}

module.exports = fn
```

## Connecting to Mongo

`idio` will try to automatically connect to the Mongo database when creating a new app. To prevent this, `autoConnect` option can be set to `false`, and a `connect` property will be set on the returned object, so that a connection can be established manually. This feature is useful when no database is required for a website.

```js
const { connect } = await idio({
  databaseURL: 'mongodb://localhost:27017',
  autoConnect: false,
})
await connect()
```

```js
// when no database is required
await idio({
  autoConnect: false,
})
```

## idio-dev

To separate the server from the developer environment, `idio-dev` is created. It has a method to watch routes updates to run on the server, and also allows to compile JS bundles for the browser.

```
yarn add -D -E idio
```

### Watching Bundles

Bundles for the client can be compiled with `idio-dev` using `watchBundles`. The method will call `browserify` with `watchify` and `babelify` to transpile files and put them in the required directory (which can be served by a `koa-static` middleware).

```js
import { watchBundles } from 'idio-dev'

const STATIC = resolve(__dirname, 'static')
const from = resolve(__dirname, 'scripts')
const to = resolve(STATIC, 'scripts')

if (!test && !production) await watchBundles({
  from, to,
  babelify: {
    babelrc: false,
    plugins: [
      '@babel/plugin-transform-modules-commonjs',
      '@babel/plugin-proposal-object-rest-spread',
    ],
    presets: [
      '@babel/preset-react',
    ],
  },
})
```


### Watching Routes

If you use `initRoutes`, for development purposes you can pass returned data to the `watchRoutes` function from `idio-dev` which allows to perform hot route reload without restarting the whole server.

```js
import idio from 'idio'
import { watchRoutes } from 'idio-dev'

const ROUTES = resolve(__dirname, 'routes')

(async () => {
  const aliases = {
    get: {
      '/index': ['/'],
    },
  }

  const { url, app, methods, router } = await idio({
    autoConnect: false,
    middleware: {
      static: {
        function(_, c) {
          return serve(STATIC, c)
        },
        config: {
          maxage: production ? 1000 * 60 * 60 * 24 * 10 : 0,
        },
        use: true,
      },
    },
  }, {
    dir: ROUTES,
    aliases,
  })

  await watchRoutes({
    dir: ROUTES,
    methods,
    router,
    aliases,
    url,
  })
  return { app, url }
})
```

```sh
http://localhost:5000/ip
  src/routes/get/ip.jsx
# update routes/ip
⌁ src/routes/get/ip.jsx
> hot reloaded GET /ip
```

<!-- ## Routes and Accessing Middleware

After the Koa server has been started, the promise will resolve with an object
containing 4 properties: `{ url, app, router, middleware }`.

- _url_: server url
- _app_: Koa app
- _router_: router, not enabled yet (see below)
- _middleware_: all set up middleware map with keys as names passed to the
`startApp` method, and functions as values.

Now you can set up routes and assign middleware to them:

```js
const { url, app, router, middleware: { session } } = await startApp({
  // ...
})
router.get('/', session, async (ctx) => {
  const n = ctx.session.views || 1
  ctx.session.views = n + 1
  ctx.body = `${n} views`
})
const routes = router.routes()
app.use(routes)

console.log(url) // http://localhost:5000
```

Congrats, you have your Koa2 server with database in `ctx.app.context`. -->

## destroy Method

An app can be destroyed (with all connections killed) by using `app.destroy`
method. This can be useful for testing - a database connection and http server
will be stopped.

## Database API

The database object is exported to `context.database`.

_to-write_

## todo

- use subdirectories when reading routes
- jsdoc for middleware settings

---

(c) [Art Deco Code][1] 2018

[1]: https://artdeco.bz
