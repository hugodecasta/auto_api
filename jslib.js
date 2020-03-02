'use strict'

var api = {is_connected:false};

(async function() {
    
    // --------------------------------------------

    let ghost = null
    let gkey = null
    let gtoken = null

    // --------------------------------------------

    async function send(path,resp_action='json',method='GET',data={},headers={}) {

        if(resp_action == 'json') {
            headers['Accept'] = 'application/json'
            headers['Content-Type'] = 'application/json'
        }

        let body = null
        if(method!='GET') {
            body = JSON.stringify(data)
        } else {
            for(let d in data) {
                path+='/'+data[d]
            }
        }
        let options = {
            method:method,
            headers:headers,
            body:body
        }

        return new Promise((ok)=>{
            let raw_response = null
            fetch(ghost+path,options)
            .then(function(response) {
                raw_response = response
                return response[resp_action]()
            })
            .then(function(response) {
                ok({response,raw_response})
            })
        })
    }

    async function get_token() {
        let resp = await send('/auth/connect','json','GET',{},{'auth-key':gkey})
        if(!resp.raw_response.ok == 200) {
            throw 'incorrect api key'
        }
        return resp.response
    }

    // --------------------------------------------

    async function get_api_map() {
        let resp = await send('','json','GET',{},{'auth-token':gtoken})
        return resp.response
    }

    function prepare_apis(api_map) {
        for(let api_name in api_map) {
            if(typeof api_map[api_name] != 'object') {
                api[api_name] = null
                continue
            }
            api[api_name] = {}
            for(let meth_name in api_map[api_name]) {
                let meth = api_map[api_name][meth_name]
                let http_method = meth.http_method.toUpperCase()
                let args = meth.args
                let func = async function() {
                    let given_args = Array.from(arguments)
                    let data = {}
                    let gid = 0
                    for(let arg_name in args) {
                        let value = args[arg_name]
                        if(value == '@user') {
                            value = given_args[gid]
                            gid++
                        }
                        data[arg_name] = value
                    }
                    let resp = await send('/'+api_name+'/'+meth_name,'json',http_method,data,{'auth-token':gtoken})
                    if(resp.response.status != 200) {
                        throw resp.response
                    }
                    return resp.response.result
                }
                api[api_name][meth_name] = func
            }
        }
    }

    // --------------------------------------------

    async function connect(host,key=null) {
        api = {is_connected:false,connect}
        ghost = host
        gkey = key
        gtoken = key==null?'notoken':await get_token()
        prepare_apis(await get_api_map())
        api.is_connected = true
    }
    api.connect = connect

    // --------------------------------------------

})()