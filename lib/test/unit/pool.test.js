"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var http = require("http");
var sinon = require("sinon");
var exponential_1 = require("../../src/backoff/exponential");
var pool_1 = require("../../src/pool");
var hosts = 2;
describe('pool', function () {
    var pool;
    var clock;
    var server;
    var sid; // random string to avoid conflicts with other running tests
    var createPool = function () {
        return new pool_1.Pool({
            backoff: new exponential_1.ExponentialBackoff({
                initial: 300,
                random: 0,
                max: 10 * 1000,
            }),
        });
    };
    beforeEach(function (done) {
        pool = createPool();
        sid = "" + Date.now() + Math.random(); // tslint:disable-line
        if (!process.env.WEBPACK) {
            var handler = require('../fixture/pool-middleware');
            server = http.createServer(handler());
            server.listen(0, function () {
                for (var i = 0; i < hosts; i += 1) {
                    pool.addHost("http://127.0.0.1:" + server.address().port);
                }
                done();
            });
        }
        else {
            for (var i = 0; i < hosts; i += 1) {
                pool.addHost(location.origin);
            }
            done();
        }
    });
    afterEach(function (done) {
        if (clock) {
            clock.restore();
        }
        if (!process.env.WEBPACK) {
            server.close(function () { return done(); });
        }
        else {
            done();
        }
    });
    it('attempts to make an https request', function () {
        var p = createPool();
        p.addHost('https://httpbin.org/get');
        return p.json({ method: 'GET', path: '/get' });
    });
    it('passes through request options', function () {
        var spy = sinon.spy(http, 'request');
        var p = createPool();
        p.addHost('https://httpbin.org/get', { rejectUnauthorized: false });
        return p.json({ method: 'GET', path: '/get' }).then(function () {
            chai_1.expect(spy.args[0][0].rejectUnauthorized).to.be.false;
        });
    });
    it('valid request data content length', function () {
        var p = createPool();
        var body = '\u00FF';
        p.addHost('https://httpbin.org/post');
        p.json({ method: 'POST', path: '/post', body: body })
            .then(function (data) { return chai_1.expect(data.data).to.equal(body); });
    });
    describe('request generators', function () {
        it('makes a text request', function () {
            return pool.text({ method: 'GET', path: '/pool/json' })
                .then(function (data) { return chai_1.expect(data).to.equal('{"ok":true}'); });
        });
        it('includes request query strings and bodies', function () {
            return pool.json({
                method: 'POST',
                path: '/pool/echo',
                query: { a: 42 },
                body: 'asdf',
            }).then(function (data) {
                chai_1.expect(data).to.deep.equal({
                    query: 'a=42',
                    body: 'asdf',
                    method: 'POST',
                });
            });
        });
        it('discards responses', function () {
            return pool.discard({ method: 'GET', path: '/pool/204' });
        });
        it('parses JSON responses', function () {
            return pool.json({ method: 'GET', path: '/pool/json' })
                .then(function (data) { return chai_1.expect(data).to.deep.equal({ ok: true }); });
        });
        it('errors if JSON parsing fails', function () {
            return pool.json({ method: 'GET', path: '/pool/badjson' })
                .then(function () { throw new Error('Expected to have thrown'); })
                .catch(function (err) { return chai_1.expect(err).to.be.an.instanceof(SyntaxError); });
        });
    });
    it('times out requests', function () {
        pool.timeout = 1;
        return pool.text({ method: 'GET', path: '/pool/json' })
            .then(function () { throw new Error('Expected to have thrown'); })
            .catch(function (err) { return chai_1.expect(err).be.an.instanceof(pool_1.ServiceNotAvailableError); })
            .then(function () { return pool.timeout = 10000; });
    });
    it('retries on a request error', function () {
        return pool.text({ method: 'GET', path: "/pool/altFail-" + sid + "/json" })
            .then(function (body) { return chai_1.expect(body).to.equal('{"ok":true}'); });
    });
    it('fails if too many errors happen', function () {
        chai_1.expect(pool.hostIsAvailable()).to.be.true;
        return pool.discard({ method: 'GET', path: '/pool/502' })
            .then(function () { throw new Error('Expected to have thrown'); })
            .catch(function (err) {
            chai_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
            chai_1.expect(pool.hostIsAvailable()).to.be.false;
        });
    });
    it('calls back immediately on un-retryable error', function () {
        return pool.discard({ method: 'GET', path: '/pool/400' })
            .then(function () { throw new Error('Expected to have thrown'); })
            .catch(function (err) {
            chai_1.expect(err).to.be.an.instanceof(pool_1.RequestError);
            chai_1.expect(err.res.statusCode).to.equal(400);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
        });
    });
    it('pings servers', function () {
        return pool.ping(1000, "/pool/altFail-" + sid + "/ping").then(function (results) {
            if (results[0].online) {
                _a = [results[1], results[0]], results[0] = _a[0], results[1] = _a[1];
            }
            chai_1.expect(results[0].online).to.be.false;
            chai_1.expect(results[1].online).to.be.true;
            chai_1.expect(results[1].version).to.equal('v1.0.0');
            var _a;
        });
    });
    it('times out in pings', function () {
        return pool.ping(1).then(function (results) {
            chai_1.expect(results[0].online).to.be.false;
            chai_1.expect(results[1].online).to.be.false;
        });
    });
    describe('backoff', function () {
        beforeEach(function () {
            clock = sinon.useFakeTimers();
            return pool.discard({ method: 'GET', path: '/pool/502' })
                .catch(function () { });
        });
        it('should error if there are no available hosts', function () {
            return pool.discard({ method: 'GET', path: '/pool/json' })
                .then(function () { throw new Error('Expected to have thrown'); })
                .catch(function (err) {
                chai_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
                chai_1.expect(err.message).to.equal('No host available');
            });
        });
        it('should reenable hosts after the backoff expires', function () {
            chai_1.expect(pool.hostIsAvailable()).to.be.false;
            clock.tick(300);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
        });
        it('should back off if failures continue', function () {
            clock.tick(300);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
            return pool.discard({ method: 'GET', path: '/pool/502' })
                .then(function () { throw new Error('Expected to have thrown'); })
                .catch(function (err) {
                chai_1.expect(err).to.be.an.instanceof(pool_1.ServiceNotAvailableError);
                chai_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                chai_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                chai_1.expect(pool.hostIsAvailable()).to.be.true;
            });
        });
        it('should reset backoff after success', function () {
            clock.tick(300);
            chai_1.expect(pool.hostIsAvailable()).to.be.true;
            return pool.discard({ method: 'GET', path: '/pool/204' }).then(function () {
                return pool.discard({ method: 'GET', path: '/pool/502' });
            })
                .then(function () { throw new Error('Expected to have thrown'); })
                .catch(function (err) {
                chai_1.expect(err).not.to.be.undefined;
                chai_1.expect(pool.hostIsAvailable()).to.be.false;
                clock.tick(300);
                chai_1.expect(pool.hostIsAvailable()).to.be.true;
            });
        });
    });
});
