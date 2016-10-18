/**
 * Created by Leo on 2016/10/1.
 */

var Request = require('request');
var site = "http://weibo.com/3952070245";

function fetch() {
    Request.get({
        uri: site, headers: {
            'User-Agent': 'google'
        }
    }, function (err, response, body) {
        if (err) {
            console.log("访问" + site + "失败");
            console.log(err);
        }
        else {
            console.log("访问" + site + "完成");
            var match = body.match(/\d+\.\d+\.\d+\.\d+/g);

            console.log(body);
        }
    });
}

fetch();