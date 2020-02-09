// ---------------------------------------------- REQUIRES

const fs = require('fs')
const cors = require('cors')
const express = require('express')
const logger = require('log-to-file')
const FastAuth = require('fast_auth')
const bodyParser = require('body-parser')

// ---------------------------------------------- VARS

const app = express()
const port = process.argv[2] || 8080
const api_map_path = process.argv[3] || './api_map.json'
const auth_dir = process.argv[4] || './auth_data'
const fast_auth = new FastAuth(auth_dir)

function log() {
    let str = Array.from(arguments).join(' ')
    logger(str,__dirname+'log.log')
    logger('[API] - '+str,'/log.log')
    console.log(...arguments)
}

// ------------------------------------------------ CONFIG

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors())

// ------------------------------------------------ FUNCTION

function get_api_caller(map) {

    let api_module = require(map.module)
    let caller_type = map.type

    let types = {
        'obj':function() {
            let exp_class_name = map.obj.exp_class_name
            let args = map.obj.args
            let constructor = exp_class_name==''?api_module:api_module[exp_class_name]
            return new constructor(...args)
        },
        'meth':function() {
            return api_module
        }
    }

    return types[caller_type]()
}

function get_token_rights(token) {
    let token_data = fast_auth.get_token_data(token)
    if(token_data == null) {
        return null
    }
    return token_data.data()
}

function get_api_map(token) {
    let api_rights = get_token_rights(token)
    if(api_rights == null) {
        return null
    }
    let full_api_map = JSON.parse(fs.readFileSync(api_map_path,'utf8'))
    let api_map = {}
    for(let api_name in api_rights) {
        let right = api_rights[api_name]
        if(right.life-right.price >= 0) {
            api_map[api_name] = full_api_map[api_name]
        } else {
            api_map[api_name] = null
        }
    }
    return api_map
}

function get_key(req) {
    if(!('auth-key' in req.headers)) {
        return null
    }
    return req.header('auth-key')
}

function get_token(req) {
    if(!('auth-token' in req.headers)) {
        return null
    }
    return req.header('auth-token')
}

// ------------------------------------------------ AUTH

app.all('/auth/connect',function(req,res) {

    let key = get_key(req)
    if(key == null) {
        res.status(400)
        res.send('missing key header')
        return
    }

    if(fast_auth.get_key_data(key) == null) {
        res.status(400)
        res.json('incorrect api key')
        return
    }
    let date = new Date()
    date.setHours(23,59,00,00)
    let this_night = Date.now()+100000*1000//date.getTime()
    let token = fast_auth.get_token(key,this_night)
    res.json(token)
})

// --------- GET ALL

app.all('/',function(req, res) {

    let token = get_token(req)
    if(token == null) {
        res.status(400)
        res.send('missing token header')
        return
    }

    let api_map = get_api_map(token)
    if(api_map == null) {
        res.status(400)
        res.json('incorrect api token')
        return 
    }

    let api_show = {}

    for(let api_name in api_map) {
        api_show[api_name] = {}
        if(api_map[api_name] == null) {
            api_show[api_name] = 'no more credits'
            continue
        }
        let http_methods = api_map[api_name].methods
        for(let http_method in  http_methods) {
            let methods = http_methods[http_method]
            for(let method in methods) {
                api_show[api_name][method] = {
                    http_method:http_method,
                    args:methods[method].args
                }
            }
        }
    }

    res.json(api_show)
})

// ------------------------------------------------ CORE

// ---------

app.all('/*',function(req, res) {

    // --- DATA
    
    res.status(200)

    let token = get_token(req)
    if(token == null) {
        res.status(400)
        res.send('missing token header')
        return
    }

    let api_map = get_api_map(token)
    if(api_map == null) {
        res.status(400)
        res.json('incorrect api token')
        return 
    }
    
    let path_sp = req.params[0].split('/')
    let api = path_sp[0]

    // --- DATA

    let result = null
    let status = 200
    let text = ''

    // --- EXEC

    if(!(api in api_map)) {
        status = 400
        text = 'api "'+api+'" not found !'
    } else {
        let map = api_map[api]
        if(map == null) {
            status = 400
            text = 'no more credits'
        } else  {
            let http_method = req.method.toLowerCase()
            if(http_method in map.methods) {

                let http_method_map = map.methods[http_method]
                let params = path_sp.slice(1)
        
                let called_method = params[0]

                if(called_method in http_method_map) {
                    let method_map = http_method_map[called_method]
                    let method_name = method_map.name
                    let arg_names = method_map.args

                    let args = []
                    let get_param = null
                    let req_body = req.body
                    if(http_method == 'get') {
                        get_param = function(name) {
                            return params.pop()
                        }
                    } else {
                        get_param = function(name) {
                            return req_body[name]
                        }
                    }
                    for(let arg_name of arg_names) {
                        args.push(get_param(arg_name))
                    }

                    try {
                        let tdata = fast_auth.get_token_data(token)
                        let api_token_map = tdata.get_data(api)
                        api_token_map.life = api_token_map.life - api_token_map.price
                        tdata.set_data(api,api_token_map)
                        log('try calling '+method_name)
                        let caller = get_api_caller(map)
                        result = caller[method_name](...args)
                        log('success')
                    } catch(err) {
                        let err_str = 'api error:'+err.name+' - '+err.message
                        err_str += ' - '+JSON.stringify(method_name)
                        err_str += ' - '+JSON.stringify(req_body)
                        err_str += ' - '+JSON.stringify(req.params[0])
                        err_str += ' - '+JSON.stringify(args)
                        log(err_str)
                        status = 500
                        text = err_str
                    }

                } else {
                    status = 400
                    text = 'wrong api method'
                }
                

            } else {
                status = 400
                text = 'wrong http method'
            }
        }

    }

    // --- RETURN

    res.json({result,status,text})

})

// ------------------------------------------------ EXECUTE

app.listen(port, function () {
    log('start auto_api a listening on',port)
})