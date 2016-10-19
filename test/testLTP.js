/**
 * Created by user on 2016/10/19.
 */
"use strict";
var request = require('request');
var url = 'http://api.ltp-cloud.com/analysis/';
var param = {
    'api_key': 'p8r2Q6H9EFvHUaqDltCLVOzJPhMmtsBtBf6WRVcp',
    'text': '#今日关注#【前三季度经济“成绩单”发布】国家统计局今日发布前三季度国民经济运行情况显示，GDP同比增长6.7%，全国居民人均可支配收入扣除价格因素实际增长6.3%。对此，国家统计局新闻发言人、国民经济综合统计司司长盛来运表示，人均收入与人均GDP增长是基本同步的。°居民收入增长低于GDP增速?国家统计局：基本同步',
    'pattern': 'ws',
    'format': 'plain'
};
request.post(url, {form: param}, (err, response, body)=> {
    if (err) {
        console.log(err);
    }
    console.log(body);
});