/**
 * Created by Leo on 2016/10/1.
 */
'use strict';
var Request = require('request'),
    weiboLoginModule = require("./weiboLogin"),
    connection_string = '127.0.0.1:27017/weiboSina',
    monk = require('monk'),
    moment = require('moment'),
    db = monk(connection_string),
    Promise = require('bluebird'),
    cheerio = require('cheerio'),
    loginMsg = require('./config').loginMsg,
    feedsReg = /feed_list\'.*<\/script>/,
    rstEndFlag = '"})</script>',
    fetchCnt = 0;

function log(msg) {
    console.log(msg);
}

function getWeibo($, feedSelector) {
    var weiboDiv = $(feedSelector);

    var weiboInfo = {
        "tbinfo": weiboDiv.attr("tbinfo"),
        "mid": weiboDiv.attr("mid"),
        "isforward": weiboDiv.attr("isforward"),
        "minfo": weiboDiv.attr("minfo"),
        "omid": weiboDiv.attr("omid"),
        "text": weiboDiv.find(".WB_detail>.WB_text").text().trim(),
        "sendAt": new Date(parseInt(weiboDiv.find(".WB_detail>.WB_from a").eq(0).attr("date")))
    };

    if (weiboInfo.isforward) {
        var forward = weiboDiv.find("div[node-type=feed_list_forwardContent]");

        if (forward.length > 0) {
            var forwardUser = forward.find("a[node-type=feed_list_originNick]");

            var userCard = forwardUser.attr("usercard");

            weiboInfo.forward = {
                name: forwardUser.attr("nick-name"),
                id: userCard ? userCard.split("=")[1] : "error",
                text: forward.find(".WB_text").text().trim(),
                "sendAt": new Date(parseInt(forward.find(".WB_from a").eq(0).attr("date")))
            };
        }
    }

    return weiboInfo;
}

function fetchUserWeibo(request, userId) {
    return new Promise((resolve, reject)=> {
        var userUrl = "http://www.weibo.com/" + userId + "?is_all=1";

        request.get({url: userUrl}, function (err, response, body) {
            if (err) {
                log("微博内容查找失败:" + userUrl);
                reject(err);
                return;
            }
            var matchRst = body.match(feedsReg);
            if (matchRst) {
                var htmlRst = '<div><div class="' + matchRst[0].substr(0, matchRst[0].length - rstEndFlag.length);
                htmlRst = htmlRst.replace(/(\\n|\\t|\\r)/g, " ").replace(/\\/g, "");
                var $ = cheerio.load(htmlRst);

                $("div[action-type=feed_list_item]").map(function (index, item) {
                    if ($(item).attr("feedtype") != "top") {
                        resolve(getWeibo($, item));
                    }
                });

                log("Completed:" + (fetchCnt++) + ", fetching:" + userId);
            }
            else {
                log("微博内容查找失败:" + userUrl);
            }
        });
    });
}


function startJob() {
    weiboLoginModule.login(loginMsg, function (err, cookieColl) {
        if (!err) {
            var request = Request.defaults({jar: cookieColl});
            var userColl = db.get("users");
            var dailyPost = db.get("dailyWeibo");
            var today = moment().format('YYYY-MM-DD');
            userColl.find({lastFetchTime: {$lte: today + ' 00:00:00'}}, {
                limit: 200,
                sort: {lastFetchTime: 1}
            }).each(function (doc) {
                if (doc.uId.length === 10) {
                    fetchUserWeibo(request, doc.uId)
                        .then(function (err, weibo) {
                            var now = moment().format('YYYY-MM-DD HH:mm:ss');
                            dailyPost.insert(weibo, (result)=> {
                                userColl.update({uId: doc.uId}, {$set: {'lastFetchTime': now}})
                            });
                        });
                }
            }).catch((err) => {
                console.log(err);
            });
        }
    });
}
startJob()
module.exports = {
    startJob: startJob
};