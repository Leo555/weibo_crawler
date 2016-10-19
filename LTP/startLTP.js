/**
 * Created by user on 2016/10/20.
 */
'use strict';

var request = require('request'),
    connection_string = '127.0.0.1:27017/weiboSina',
    monk = require('monk'),
    moment = require('moment'),
    db = monk(connection_string),
    Promise = require('bluebird'),
    _ = require('lodash');

var url = 'http://api.ltp-cloud.com/analysis/';
var param = {
    'api_key': 'p8r2Q6H9EFvHUaqDltCLVOzJPhMmtsBtBf6WRVcp',
    'pattern': 'ws',
    'format': 'plain'
};

startLTPJob();
function startLTPJob() {
    var dailyPost = db.get("dailyWeibo");
    dailyPost.find({}, {
            limit: 100,
            sort: {lastFetchTime: 1}
        })
        .then((docs)=> {
            var tasks = [];
            _.each(docs, (doc)=> {
                if (doc.text) {
                    tasks.push(sendReq(doc._id, doc.text));
                }
            });
        });
}

function sendReq(id, text) {
    var userColl = db.get("users");
    param.text = text;
    request.post(url, {form: param}, (err, response, body)=> {
        if (err) {
            console.log(err);
        } else {
            console.log(body);
            userColl.findOneAndUpdate({_id: id}, {$set: {ltpResult: body}});
        }
    });
}