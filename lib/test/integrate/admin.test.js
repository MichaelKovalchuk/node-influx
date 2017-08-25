"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var helpers_1 = require("./helpers");
describe('administrative actions', function () {
    var db;
    beforeEach(function () {
        return helpers_1.newClient().then(function (client) { return db = client; });
    });
    describe('users', function () {
        var expectUser = function (name, admin) {
            return db.getUsers()
                .then(function (users) { return chai_1.expect(users).to.contain({ user: name, admin: admin }); })
                .then(function () { return undefined; });
        };
        beforeEach(function () { return db.createUser('connor', 'foo', false); });
        afterEach(function () { return db.dropUser('connor').catch(function () { }); });
        it('creates users', function () { return expectUser('connor', false); });
        it('grants admin privs', function () {
            return db.grantAdminPrivilege('connor')
                .then(function () { return expectUser('connor', true); });
        });
        it('revokes admin privs', function () {
            return db.grantAdminPrivilege('connor')
                .then(function () { return db.revokeAdminPrivilege('connor'); })
                .then(function () { return expectUser('connor', false); });
        });
        it('grants specific privs', function () {
            return db.grantPrivilege('connor', 'READ'); // should not reject
        });
        it('drops users', function () {
            return db.dropUser('connor')
                .then(function () { return db.getUsers(); })
                .then(function (users) { return chai_1.expect(users.map(function (u) { return u.user; })).not.to.contain('connor'); });
        });
    });
    describe('retention policies', function () {
        var expectPolicy = function (policy) {
            return db.showRetentionPolicies()
                .then(function (rps) { return chai_1.expect(rps).to.contain(policy); })
                .then(function () { return undefined; });
        };
        beforeEach(function () {
            return db.createRetentionPolicy('7d', {
                duration: '7d',
                replication: 1,
            });
        });
        afterEach(function () { return db.dropRetentionPolicy('7d').catch(function (err) { }); });
        it('creates policies', function () {
            return expectPolicy({
                default: false,
                duration: '168h0m0s',
                name: '7d',
                replicaN: 1,
                shardGroupDuration: '24h0m0s',
            });
        });
        it('alters policies', function () {
            return db.alterRetentionPolicy('7d', {
                duration: '7d',
                replication: 1,
                isDefault: true,
            }).then(function () {
                return expectPolicy({
                    default: true,
                    duration: '168h0m0s',
                    name: '7d',
                    replicaN: 1,
                    shardGroupDuration: '24h0m0s',
                });
            });
        });
        it('drops policies', function () {
            return db.dropRetentionPolicy('7d')
                .then(function () { return db.showRetentionPolicies(); })
                .then(function (rps) { return chai_1.expect(rps.map(function (rp) { return rp.name; })).to.not.contain('7d'); });
        });
    });
    describe('continuous queries', function () {
        var sampleQuery = 'SELECT MEAN(cpu) INTO "7d"."perf" FROM "1d"."perf" GROUP BY time(1m)';
        beforeEach(function () {
            return Promise.all([
                db.createRetentionPolicy('7d', {
                    duration: '7d',
                    replication: 1,
                }),
                db.createRetentionPolicy('1d', {
                    duration: '1d',
                    replication: 1,
                }),
            ]);
        });
        afterEach(function () {
            return Promise.all([
                db.dropRetentionPolicy('7d'),
                db.dropRetentionPolicy('1d'),
                db.dropContinuousQuery('7d_perf').catch(function (err) { }),
            ]);
        });
        it('creates continuous queries', function () {
            return db.createContinuousQuery('7d_perf', sampleQuery)
                .then(function () { return db.showContinousQueries(); })
                .then(function (queries) {
                chai_1.expect(queries.slice()).to.deep.equal([
                    { name: '7d_perf', query: 'CREATE CONTINUOUS QUERY "7d_perf" ON '
                            + 'influx_test_db BEGIN SELECT mean(cpu) INTO influx_test_db."7d".perf '
                            + 'FROM influx_test_db."1d".perf GROUP BY time(1m) END' },
                ]);
            });
        });
        it('drops continuous queries', function () {
            return db.createContinuousQuery('7d_perf', sampleQuery)
                .then(function () { return db.showContinousQueries(); })
                .then(function () { return db.dropContinuousQuery('7d_perf'); })
                .then(function () { return db.showContinousQueries(); })
                .then(function (queries) { return chai_1.expect(queries).to.have.length(0); });
        });
    });
});
