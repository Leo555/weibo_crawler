/**
 * Created by user on 2016/10/19.
 */
"use strict";
var request = require('request');
var url = 'http://api.ltp-cloud.com/analysis/';
var param = {
    'api_key': 'p8r2Q6H9EFvHUaqDltCLVOzJPhMmtsBtBf6WRVcp',
    'text': '我是中国人',
    'pattern': 'ws',
    'format': 'plain'
};
request.post(url, {form: param}, (err, response, body)=> {
    if (err) {
        console.log(err);
    }
    console.log(body);
});