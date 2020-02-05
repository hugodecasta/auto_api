// ---------------------------------------------- REQUIRES

const fs = require('fs')
const express = require('express')
const logger = require('log-to-file')

// ---------------------------------------------- VARS

const app = express()
const port = process.argv[2] || 8080
const api_map_path = process.argv[3] || './api_map.json'

function log() {
    let str = Array.from(arguments).join(' ')
    logger(str,__dirname+'log.log')
    logger('[API] - '+str,'log.log')
    console.log(...arguments)
}

// ------------------------------------------------ CONFIG

const bodyParser = require('body-parser')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true})); 

// ------------------------------------------------ FUNCTION

function get_api_map() {
    let api_map = JSON.parse(fs.readFileSync(api_map_path,'utf8'))
    return api_map
}

function get_api_caller(map) {

    let api_module = require(map.module)
    let caller_type = map.type

    let types = {
        'obj':function() {
            let exp_class_name = map.obj.exp_class_name
            let args = map.obj.args
            let constructor = exp_class_name==''?api_module:api_module[exp_class_name]
            return new constructor(...args)
        }
    }

    return types[caller_type]()
}

// ------------------------------------------------ CORE

app.get('/',function(req, res) {
    let api_map = get_api_map()

    let api_show = {}

    for(let api_name in api_map) {
        let http_methods = api_map[api_name].methods
        api_show[api_name] = {}
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

    res.json({apis:api_show})
})

// ---------

app.all('/*',function(req, res) {

    let api_map = get_api_map()

    // --- DATA
    
    let path_sp = req.params[0].split('/')
    let api = path_sp[0]

    // --- DATA

    let response = null
    let status = 200
    let text = ''

    // --- EXEC

    if(!(api in api_map)) {
        status = 400
        text = 'api "'+api+'" not found !'
    } else {
        let map = api_map[api]
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
                    log('try calling '+method_name)
                    let caller = get_api_caller(map)
                    response = caller[method_name](...args)
                    log('success')
                } catch(err) {
                    log('api error:'+err.name+' - '+err.message)
                    status = 500
                    text = 'api error '+err.name+' - '+err.message
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

    // --- RETURN

    res.json({response,status,text})

})

// ------------------------------------------------ EXECUTE

app.listen(port, function () {
    log('start auto_api a listening on',port)
})