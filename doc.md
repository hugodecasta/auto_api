# Auto api - documentation

Hugo Castaneda - 09/02/2020

---

### fundamentals

  * auto_api is based on [nodejs](https://nodejs.org/) and the [express](https://www.npmjs.com/package/express) module
  * auto_api uses the [fast_auth](https://github.com/hugodecasta/fast_auth) module to authenticate api users.
  * an api can be called using this patterns (depending on the http method)
    * **base caller** `/ <api_name> / <api_method>`
    * **GET** `(base caller) / <arg_1> / <arg_2> / etc.`
    * **POST**/**PUT**/**DELETE** `(base caller) + body data = {arg1:value1, arg2:value2, etc.}`
  * each api name / methods are described in the config file

### config

auto_api uses an api_map config file to setup api routes, http methods, api method and arguments requirement.

Api config data is stored in a json formated file.

api_map example (api to generate html colored text):
``` json
 {
    "my_api": {
      "module":"./colorer.js",
      "type":"obj",
      "obj": {
        "exp_class_name":"",
        "args": ["calibri"]
      },
      "methods": {
        "get": {
          "print": {
            "name":"print",
            "args":["color","text"]
          },
          "shout": {
            "name":"shouter",
            "args":["text"]
          }
        },
        "post": {
          "set_font": {
            "name":"font",
            "args":["font"]
          }
        }
      }
    }
 }
```
In this example, we declare an new api `my_api`.
 * It uses a module file `./colorer.js`
 * The api is of type `obj` (meaning the api is represented by an object in the module)
   * This object can be called using method "" (direct call on the module) and with arguments `"calibri"`
   
 * the only 2 callable http method are `GET` and `POST`
   * 2 methods can be called on get
     * `"print"` (which real name in the module object is `"print"`) callable with 2 argument.
     * `"shout"` (which real name in the module object is `"shouter"`) callable with 1 argument.
   * 1 method can be called on post
     * `"set_font"` (which real name in the module object is `"font"`) callable with 1 argument.

### execution

In order to execute the auto_api system one uses this following command

`node <auto_api_dir_path> <port> <config_file_path>`

example: `node . 9001 ./api_map_config.json`

### calling

To call the api from a client side, you need to follow the auth and connection procedure
  * first retrieve a connection toke from the fadt_auth system
    connect to the auto_api server and call `/auth/connect` with header `Auth-Key: <your fast_auth key>`
    The aut_api server will answer with a json formated string containing the auth token
  * Then use this token to call the api
    use the api as described before (get or post http method) and add the header `Auth-Token: <the given auth token>`
    
When the token header is set, you can call the api as described before.

Example using the colorer module:

  * `GET : /my_api/print/#fff/bonjour`
  * `GET : /my_api/shout/COUCOU`
  * `POST : /my_api/set_font -p font="Roboto"`

### results

When called by a client, the api will return a json formated object containing these informations
  * **result** is the object returned by the called api
  * **status** the status code returned by the auto_api system or the called api
  * **text** a simple description text (used by auto_api in error cases)
  
If something whent wrong, here is some common error examples that can be returned by the system

#### api errors
  * `{result:null, status:400, text:"wrong api method"}` when the api method specified in the url is not found in the api map
  * `{result:null, status:400, text:"wrong http method"}` when the api is called using an unsupported http method
  
#### system errors
  * `{result:null, status:500, text:<message>}` when an error occured whil the called api was executing
  * `{result:null, status:400, text:"api not found"}` when the api in the url is not found in the api_map
  
#### fast_auth errors
  * `{result:null, status:400, text:"not more credit"}` when the calling user has no more auth credit on the called api
  * `{result:null, status:400, text:"missing token header"}` when the auth token is missing from the request header
  * `{result:null, status:400, text:"incorrect api token"}` when the auth token is not valid

## Fast_Auth specification for Auto_api

The auto api system uses fath_auth to authenticate users and give them access to apis.
The fast_auth system uses keys stroring data template that can be copied into a usable token.
Only the token data are modified by the auto_api system.

Here is the specification of a fast_auth key data useable by the auto_api system
  * **data** must contain an object with api names as keys
    * each api_name references a credit json object containing these properties
      * *life* a given point amount when the token is generated
      * *price* the price unit for this key on this api removed from the token life when the api is called
      
An example of key for the `my_api` example
``` json

key -> "hugo1234"

data ->
{

  "my_api": {
    "life": 1000,
    "price": 2
  },
  
  "another_api": {
    "life": 1,
    "price": 0
  }
  
}

```

Note in the example that in the key, the `"another_api"` api has an infinite life (no point is removed (0) when the api is used).
  
  * When the api `my_api` is used, 2 points is removed from life of the api on the token generated from this key.
  * When the condition `life - price < 0` is reached, the api in the token is considered "out of credit". 
  A new fresh token must be generated in order to reset all api life.
