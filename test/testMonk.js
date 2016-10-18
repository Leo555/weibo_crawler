/**
 * Created by LILE8 on 10/18/2016.
 */
"use strict";
var monk = require('monk'),
    _ = require('lodash'),
    moment = require('moment');

var connection_string = '127.0.0.1:27017/weiboSina',
    db = monk(connection_string);

var userColl = db.get("users");

userColl.update({createTime: {$exists: false}},
    {
        $set: {
            createTime: moment().format('YYYY-MM-DD HH:mm:SS'), updateBy: 'LILE8-W7', "lastFetchTime": "",
            "lastFetchResult": false
        }
    },
    {
        multi: true
    }
).then((res)=> {
    console.log(res);
});