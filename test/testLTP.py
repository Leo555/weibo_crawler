# -*- coding: utf-8 -*-
import urllib.parse
import urllib.request

if __name__ == '__main__':
    url_get_base = "http://api.ltp-cloud.com/analysis/"
    args = {
        'api_key': 'p8r2Q6H9EFvHUaqDltCLVOzJPhMmtsBtBf6WRVcp',
        'text': 'test',
        'pattern': 'all',
        'format': 'plain'
    }
    # with urllib.request.urlopen(url_get_base, urllib.parse.urlencode(args)) as result:
    #     s = result.read().strip()
    # print(s)
    req = urllib.request.Request(url_get_base, data=urllib.parse.urlencode(args))
    f = urllib.request.urlopen(req)
    resp = f.read()
    print(resp)
