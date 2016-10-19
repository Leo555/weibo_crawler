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
var dailyPost = db.get("dailyWeibo");

startLTPJob();
function startLTPJob() {
    dailyPost.find({}, {
            limit: 100,
            sort: {lastFetchTime: 1}
        })
        .then((docs)=> {
            var tasks = [];
            _.each(docs, (doc)=> {
                if (doc.text) {
                    tasks.push(sendReq(doc._id, doc.text.replace(/[&\|\\\*！.!`~,，…【】:：、；（）?？();/-<>“”""《》。^%$#@\-]/g, " ")));
                }
            });
        });
}

function sendReq(id, text) {
    param.text = text;
    request.post(url, {form: param}, (err, response, body)=> {
        console.log(text);
        if (err) {
            console.log(err);
        } else {
            console.log(body);
            dailyPost.findOneAndUpdate({_id: id}, {$set: {ltpResult: body}});
        }
    });
}

function replaceAll(text) {
    
}