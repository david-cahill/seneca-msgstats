# seneca-msgstats

### Node.js Seneca Message Statistics

This module is a plugin for the [Seneca
framework](http://senecajs.org). It provides a message throughput statistics.

Current Version: 0.1.0

Tested on: Seneca 0.5.21, Node 0.10.31


### Quick example


```JavaScript
var influxOptions = { host:'localhost',
                      port: 8086,
                      username:'root',
                      password:'root',
                      database:'test_db',
                      seriesName:'test_series'
                    };
seneca.use('msgstats', {pin:{}, influxOpts:influxOptions});
```

Options can also be set in options.mine.js, e.g:

```JavaScript
msgstats: {
    pin:{},
    influxOpts:{
      host:'localhost',
      port: 8086,
      username:'root',
      password:'root',
      database:'test_db2',
      seriesName:'actions'
    }
  }

seneca.use('msgstats');
```

## Requirements

InfluxDB must be installed. 
Please see the installation guide here:
http://influxdb.com/docs/v0.6/introduction/installation.html

## Install

```sh
npm install seneca
npm install seneca-msgstats
```

## Capturing Seneca Actions

To capture all seneca actions, set the pin in the options to:

```JavaScript
pin: {}
```

To only capture <code>role:web</code> actions, set the pin to:

```JavaScript
pin: {role:'web'}
```

## Message Patterns

Foo.

   * `role:msgstats, cmd:foo` foo

Bar.


## Test

```bash
mocha test/*.test.js
```

