'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var src_1 = require("../../src");
var helpers_1 = require("./helpers");
var sinon = require('sinon');
describe('influxdb', function () {
    describe('constructor', function () {
        it('uses default options', function () {
            chai_1.expect(new src_1.InfluxDB().options).to.deep.equal({
                username: 'root',
                password: 'root',
                database: null,
                pool: undefined,
                schema: [],
                hosts: [{
                        host: '127.0.0.1',
                        port: 8086,
                        protocol: 'http',
                        options: undefined,
                    }],
            });
        });
        it('parses dsns', function () {
            chai_1.expect(new src_1.InfluxDB('https://connor:password@192.168.0.1:1337/foo').options).to.deep.equal({
                username: 'connor',
                password: 'password',
                database: 'foo',
                pool: undefined,
                schema: [],
                hosts: [{
                        host: '192.168.0.1',
                        port: 1337,
                        protocol: 'https',
                        options: undefined,
                    }],
            });
        });
        it('parses single configs', function () {
            chai_1.expect(new src_1.InfluxDB({ database: 'foo', host: '192.168.0.1' }).options).to.deep.equal({
                username: 'root',
                password: 'root',
                database: 'foo',
                pool: undefined,
                schema: [],
                hosts: [{
                        host: '192.168.0.1',
                        port: 8086,
                        protocol: 'http',
                        options: undefined,
                    }],
            });
        });
        it('parses cluster configs', function () {
            chai_1.expect(new src_1.InfluxDB({
                database: 'foo',
                hosts: [{ host: '192.168.0.1', options: { ca: null } }],
            }).options).to.deep.equal({
                username: 'root',
                password: 'root',
                database: 'foo',
                schema: [],
                hosts: [{
                        host: '192.168.0.1',
                        port: 8086,
                        protocol: 'http',
                        options: { ca: null },
                    }],
            });
        });
        it('parses parses schema', function () {
            var client = new src_1.InfluxDB({
                schema: [{
                        database: 'my_db',
                        measurement: 'my_measurement',
                        fields: {},
                        tags: ['my_tag'],
                    }],
                hosts: [{ host: '192.168.0.1', options: undefined }],
            });
            chai_1.expect(client.schema.my_db.my_measurement).to.not.be.undefined;
            client = new src_1.InfluxDB({
                schema: [{
                        measurement: 'my_measurement',
                        fields: {},
                        tags: ['my_tag'],
                    }],
                database: 'my_db',
                hosts: [{ host: '192.168.0.1' }],
            });
            chai_1.expect(client.schema.my_db.my_measurement).to.not.be.undefined;
            chai_1.expect(function () {
                new src_1.InfluxDB({
                    schema: [{
                            measurement: 'my_measurement',
                            fields: {},
                            tags: ['my_tag'],
                        }],
                    hosts: [{ host: '192.168.0.1' }],
                });
            }).to.throw(/no default database is provided/);
        });
    });
    describe('methods', function () {
        var influx;
        var pool;
        var expectations = [];
        beforeEach(function () {
            influx = new src_1.InfluxDB({
                hosts: [],
                schema: [
                    {
                        database: 'my_db',
                        measurement: 'my_schemed_measure',
                        tags: ['my_tag'],
                        fields: {
                            int: src_1.FieldType.INTEGER,
                            float: src_1.FieldType.FLOAT,
                            string: src_1.FieldType.STRING,
                            bool: src_1.FieldType.BOOLEAN,
                        },
                    },
                ],
            });
            pool = influx.pool;
            sinon.stub(pool, 'discard');
            sinon.stub(pool, 'json');
            sinon.stub(pool, 'text');
        });
        afterEach(function () {
            while (expectations.length) {
                expectations.pop()();
            }
        });
        var setDefaultDB = function (db) {
            influx.options.database = db;
        };
        var expectQuery = function (method, options, httpMethod, yields) {
            if (httpMethod === void 0) { httpMethod = 'POST'; }
            if (yields === void 0) { yields = { results: [{}] }; }
            if (typeof options === 'string') {
                options = { q: options };
            }
            pool[method].returns(Promise.resolve(yields));
            expectations.push(function () {
                chai_1.expect(pool[method]).to.have.been.calledWith({
                    method: httpMethod,
                    path: '/query',
                    query: Object.assign({
                        u: 'root',
                        p: 'root',
                    }, options),
                });
            });
        };
        var expectWrite = function (body, options) {
            if (typeof options === 'string') {
                options = { q: options };
            }
            pool.discard.returns(Promise.resolve());
            expectations.push(function () {
                chai_1.expect(pool.discard).to.have.been.calledWith({
                    method: 'POST',
                    path: '/write',
                    body: body,
                    query: Object.assign({
                        u: 'root',
                        p: 'root',
                    }, options),
                });
            });
        };
        it('.createDatabase()', function () {
            expectQuery('json', 'create database "foo"');
            influx.createDatabase('foo');
            expectQuery('json', 'create database "f\\"oo"');
            influx.createDatabase('f"oo');
        });
        it('.dropDatabase()', function () {
            expectQuery('json', 'drop database "foo"');
            influx.dropDatabase('foo');
            expectQuery('json', 'drop database "f\\"oo"');
            influx.dropDatabase('f"oo');
        });
        it('.getDatabaseNames()', function () {
            expectQuery('json', 'show databases', 'GET', helpers_1.dbFixture('showDatabases'));
            return influx.getDatabaseNames().then(function (names) {
                chai_1.expect(names).to.deep.equal(['_internal', 'influx_test_gen']);
            });
        });
        it('.getMeasurements()', function () {
            setDefaultDB('mydb');
            expectQuery('json', {
                db: 'mydb',
                q: 'show measurements',
            }, 'GET', helpers_1.dbFixture('showMeasurements'));
            return influx.getMeasurements().then(function (names) {
                chai_1.expect(names).to.deep.equal(['series_0', 'series_1', 'series_2']);
            });
        });
        it('.getSeries() from all', function () {
            setDefaultDB('mydb');
            expectQuery('json', {
                db: 'mydb',
                q: 'show series',
            }, 'GET', helpers_1.dbFixture('showSeries'));
            return influx.getSeries().then(function (names) {
                chai_1.expect(names).to.deep.equal([
                    'series_0,my_tag=0',
                    'series_0,my_tag=1',
                    'series_0,my_tag=5',
                    'series_0,my_tag=6',
                    'series_0,my_tag=7',
                    'series_0,my_tag=8',
                    'series_0,my_tag=9',
                    'series_1,my_tag=0',
                    'series_1,my_tag=2',
                    'series_1,my_tag=4',
                    'series_1,my_tag=5',
                    'series_1,my_tag=6',
                    'series_1,my_tag=7',
                    'series_1,my_tag=8',
                    'series_1,my_tag=9',
                    'series_2,my_tag=1',
                    'series_2,my_tag=2',
                    'series_2,my_tag=3',
                    'series_2,my_tag=4',
                    'series_2,my_tag=5',
                    'series_2,my_tag=6',
                    'series_2,my_tag=7',
                    'series_2,my_tag=8',
                    'series_2,my_tag=9',
                ]);
            });
        });
        it('.getSeries() from single', function () {
            expectQuery('json', {
                db: 'mydb',
                q: 'show series from "measure_1"',
            }, 'GET', helpers_1.dbFixture('showSeriesFromOne'));
            return influx.getSeries({
                database: 'mydb',
                measurement: 'measure_1',
            }).then(function (names) {
                chai_1.expect(names).to.deep.equal([
                    'series_1,my_tag=0',
                    'series_1,my_tag=2',
                    'series_1,my_tag=4',
                    'series_1,my_tag=5',
                    'series_1,my_tag=6',
                    'series_1,my_tag=7',
                    'series_1,my_tag=8',
                    'series_1,my_tag=9',
                ]);
            });
        });
        it('.dropMeasurement()', function () {
            expectQuery('json', {
                db: 'my_db',
                q: 'drop measurement "series_1"',
            });
            return influx.dropMeasurement('series_1', 'my_db');
        });
        describe('.dropSeries()', function () {
            beforeEach(function () { return setDefaultDB('my_db'); });
            it('drops with only from clause by string', function () {
                expectQuery('json', { db: 'my_db', q: 'drop series from "series_0"' });
                influx.dropSeries({ measurement: '"series_0"' });
            });
            it('drops with only from clause by builder', function () {
                expectQuery('json', { db: 'my_db', q: 'drop series from "series_0"' });
                influx.dropSeries({ measurement: function (m) { return m.name('series_0'); } });
            });
            it('drops with only where clause by string', function () {
                expectQuery('json', { db: 'my_db', q: 'drop series where "my_tag" = 1' });
                influx.dropSeries({ where: '"my_tag" = 1' });
            });
            it('drops with only where clause by builder', function () {
                expectQuery('json', { db: 'my_db', q: 'drop series where "my_tag" = 1' });
                influx.dropSeries({ where: function (e) { return e.tag('my_tag').equals.value(1); } });
            });
            it('drops with both', function () {
                expectQuery('json', { db: 'my_db', q: 'drop series from "series_0" where "my_tag" = 1' });
                influx.dropSeries({
                    measurement: function (m) { return m.name('series_0'); },
                    where: function (e) { return e.tag('my_tag').equals.value(1); },
                });
            });
        });
        it('.getUsers()', function () {
            expectQuery('json', 'show users', 'GET', helpers_1.dbFixture('showUsers'));
            return influx.getUsers().then(function (names) {
                chai_1.expect(names.slice()).to.deep.equal([
                    { user: 'john', admin: true },
                    { user: 'steve', admin: false },
                ]);
            });
        });
        describe('.createUser()', function () {
            it('works with admin specified == true', function () {
                expectQuery('json', 'create user "con\\"nor" with password \'pa55\\\'word\' with all privileges');
                return influx.createUser('con"nor', 'pa55\'word', true);
            });
            it('works with admin specified == false', function () {
                expectQuery('json', 'create user "con\\"nor" with password \'pa55\\\'word\'');
                return influx.createUser('con"nor', 'pa55\'word', false);
            });
            it('works with admin unspecified', function () {
                expectQuery('json', 'create user "con\\"nor" with password \'pa55\\\'word\'');
                return influx.createUser('con"nor', 'pa55\'word');
            });
        });
        describe('.grantPrivilege()', function () {
            it('queries correctly', function () {
                expectQuery('json', 'grant READ on "my_\\"_db" to "con\\"nor"');
                return influx.grantPrivilege('con"nor', 'READ', 'my_"_db');
            });
            it('throws if DB unspecified', function () {
                chai_1.expect(function () { return influx.grantPrivilege('con"nor', 'READ'); }).to.throw(/default database/);
            });
            it('fills in default DB', function () {
                setDefaultDB('my_\\"_db');
                expectQuery('json', 'grant READ on "my_\\"_db" to "con\\"nor"');
                return influx.grantPrivilege('con"nor', 'READ', 'my_"_db');
            });
        });
        describe('.revokePrivilege()', function () {
            it('queries correctly', function () {
                expectQuery('json', 'revoke READ on "my_\\"_db" from "con\\"nor"');
                return influx.revokePrivilege('con"nor', 'READ', 'my_"_db');
            });
            it('throws if DB unspecified', function () {
                chai_1.expect(function () { return influx.revokePrivilege('con"nor', 'READ'); }).to.throw(/default database/);
            });
            it('fills in default DB', function () {
                setDefaultDB('my_\\"_db');
                expectQuery('json', 'revoke READ on "my_\\"_db" from "con\\"nor"');
                return influx.revokePrivilege('con"nor', 'READ', 'my_"_db');
            });
        });
        it('.grantAdminPrivilege()', function () {
            expectQuery('json', 'grant all to "con\\"nor"');
            return influx.grantAdminPrivilege('con"nor');
        });
        it('.revokeAdminPrivilege()', function () {
            expectQuery('json', 'revoke all from "con\\"nor"');
            return influx.revokeAdminPrivilege('con"nor');
        });
        it('.dropUser()', function () {
            expectQuery('json', 'drop user "con\\"nor"');
            return influx.dropUser('con"nor');
        });
        describe('.createContinuousQuery()', function () {
            it('queries correctly no resample', function () {
                expectQuery('json', 'create continuous query "my_\\"q" on "my_\\"_db"  begin foo end');
                return influx.createContinuousQuery('my_"q', 'foo', 'my_"_db');
            });
            it('queries correctly with resample', function () {
                expectQuery('json', 'create continuous query "my_\\"q" on "my_\\"_db" resample for 4m begin foo end');
                return influx.createContinuousQuery('my_"q', 'foo', 'my_"_db', 'resample for 4m');
            });
            it('throws if DB unspecified', function () {
                chai_1.expect(function () { return influx.createContinuousQuery('my_"q', 'foo'); }).to.throw(/default database/);
            });
            it('fills in default DB', function () {
                setDefaultDB('my_"_db');
                expectQuery('json', 'create continuous query "my_\\"q" on "my_\\"_db"  begin foo end');
                return influx.createContinuousQuery('my_"q', 'foo');
            });
        });
        describe('.dropContinuousQuery()', function () {
            it('queries correctly', function () {
                expectQuery('json', 'drop continuous query "my_\\"q" on "my_\\"_db"');
                return influx.dropContinuousQuery('my_"q', 'my_"_db');
            });
            it('throws if DB unspecified', function () {
                chai_1.expect(function () { return influx.dropContinuousQuery('my_"q'); }).to.throw(/default database/);
            });
            it('fills in default DB', function () {
                setDefaultDB('my_"_db');
                expectQuery('json', 'drop continuous query "my_\\"q" on "my_\\"_db"');
                return influx.dropContinuousQuery('my_"q');
            });
        });
        describe('.showContinousQueries()', function () {
            it('queries correctly', function () {
                expectQuery('json', { q: 'show continuous queries', db: 'my_db' }, 'GET');
                return influx.showContinousQueries('my_db');
            });
            it('throws if DB unspecified', function () {
                chai_1.expect(function () { return influx.showContinousQueries(); }).to.throw(/default database/);
            });
            it('fills in default DB', function () {
                setDefaultDB('my_db');
                expectQuery('json', { q: 'show continuous queries', db: 'my_db' }, 'GET');
                return influx.showContinousQueries();
            });
        });
        describe('.writePoints()', function () {
            it('writes with all options specified without a schema', function () {
                expectWrite('mymeas,my_tag=1 myfield=90 1463683075', {
                    precision: 's',
                    rp: '1day',
                    db: 'my_db',
                });
                return influx.writePoints([
                    {
                        measurement: 'mymeas',
                        tags: { my_tag: '1' },
                        fields: { myfield: 90 },
                        timestamp: new Date(1463683075000),
                    },
                ], {
                    database: 'my_db',
                    precision: 's',
                    retentionPolicy: '1day',
                });
            });
            it('writes using default options without a schema', function () {
                setDefaultDB('my_db');
                expectWrite('mymeas,my_tag=1 myfield=90 1463683075000000000', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writePoints([
                    {
                        measurement: 'mymeas',
                        tags: { my_tag: '1' },
                        fields: { myfield: 90 },
                        timestamp: new Date(1463683075000),
                    },
                ]);
            });
            it('uses a schema to coerce', function () {
                setDefaultDB('my_db');
                expectWrite('my_schemed_measure,my_tag=1 bool=T,float=43,int=42i', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writePoints([
                    {
                        measurement: 'my_schemed_measure',
                        tags: { my_tag: '1' },
                        fields: {
                            int: 42,
                            float: 43,
                            bool: true,
                        },
                    },
                ]);
            });
            it('throws on schema violations', function () {
                setDefaultDB('my_db');
                chai_1.expect(function () {
                    influx.writePoints([
                        {
                            measurement: 'my_schemed_measure',
                            tags: { not_a_tag: '1' },
                        },
                    ]);
                }).to.throw(/extraneous tags/i);
                chai_1.expect(function () {
                    influx.writePoints([
                        {
                            measurement: 'my_schemed_measure',
                            fields: { not_a_field: '1' },
                        },
                    ]);
                }).to.throw(/extraneous fields/i);
                chai_1.expect(function () {
                    influx.writePoints([
                        {
                            measurement: 'my_schemed_measure',
                            fields: { bool: 'lol, not a bool' },
                        },
                    ]);
                }).to.throw(/expected bool/i);
            });
            it('handles lack of tags', function () {
                expectWrite('mymeas myfield=90', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writePoints([
                    {
                        measurement: 'mymeas',
                        fields: { myfield: 90 },
                    },
                ], { database: 'my_db' });
            });
            it('handles lack of fields', function () {
                expectWrite('mymeas,my_tag=90', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writePoints([
                    {
                        measurement: 'mymeas',
                        tags: { my_tag: 90 },
                    },
                ], { database: 'my_db' });
            });
            it('handles multiple tags', function () {
                expectWrite('mymeas,my_tag1=90,my_tag2=45', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writePoints([
                    {
                        measurement: 'mymeas',
                        tags: { my_tag1: 90, my_tag2: 45 },
                    },
                ], { database: 'my_db' });
            });
            it('writes with the .writeMeasurement method', function () {
                setDefaultDB('my_db');
                expectWrite('mymeas,my_tag=1 myfield=90 1463683075000000000', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writeMeasurement('mymeas', [
                    {
                        tags: { my_tag: '1' },
                        fields: { myfield: 90 },
                        timestamp: new Date(1463683075000),
                    },
                ]);
            });
            it('accepts nanoseconds (as ms)', function () {
                setDefaultDB('my_db');
                expectWrite('mymeas,my_tag=1 myfield=90 1463683075000000000', {
                    precision: 'n',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writeMeasurement('mymeas', [
                    {
                        tags: { my_tag: '1' },
                        fields: { myfield: 90 },
                        timestamp: src_1.toNanoDate('1463683075000000000'),
                    },
                ]);
            });
            it('accepts timestamp overriding', function () {
                setDefaultDB('my_db');
                expectWrite('mymeas,my_tag=1 myfield=90 1463683075000', {
                    precision: 'ms',
                    rp: undefined,
                    db: 'my_db',
                });
                return influx.writeMeasurement('mymeas', [
                    {
                        tags: { my_tag: '1' },
                        fields: { myfield: 90 },
                        timestamp: src_1.toNanoDate('1463683075000000000'),
                    },
                ], { precision: 'ms' });
            });
        });
        describe('.query', function () {
            beforeEach(function () { return setDefaultDB('my_db'); });
            it('runs raw queries', function () {
                expectQuery('json', {
                    q: 'select * from series_0',
                    epoch: undefined,
                    rp: undefined,
                    db: 'my_db',
                }, 'GET', helpers_1.dbFixture('selectFromOne'));
                return influx.queryRaw('select * from series_0').then(function (res) {
                    chai_1.expect(res).to.deep.equal(helpers_1.dbFixture('selectFromOne'));
                });
            });
            it('parses query output', function () {
                expectQuery('json', {
                    q: 'select * from series_0',
                    epoch: undefined,
                    rp: undefined,
                    db: 'my_db',
                }, 'GET', helpers_1.dbFixture('selectFromOne'));
                return influx.query('select * from series_0').then(function (res) {
                    chai_1.expect(res.slice()).to.deep.equal([
                        { time: new Date('2016-09-29T02:19:09.38Z'), my_tag: '1', my_value: 67 },
                        { time: new Date('2016-09-29T02:19:09.379Z'), my_tag: '1', my_value: 32 },
                    ]);
                });
            });
            it('selects from multiple', function () {
                expectQuery('json', {
                    q: 'select * from series_0;select * from series_1',
                    epoch: undefined,
                    rp: undefined,
                    db: 'my_db',
                }, 'GET', helpers_1.dbFixture('selectFromOne'));
                return influx.query(['select * from series_0', 'select * from series_1']);
            });
            it('passes in options', function () {
                expectQuery('json', {
                    q: 'select * from series_0',
                    epoch: 'ms',
                    rp: 'asdf',
                    db: 'my_db',
                }, 'GET', helpers_1.dbFixture('selectFromOne'));
                return influx.query(['select * from series_0'], {
                    precision: 'ms',
                    retentionPolicy: 'asdf',
                });
            });
            it('rewrites nanosecond precisions', function () {
                expectQuery('json', {
                    q: 'select * from series_0',
                    epoch: undefined,
                    rp: 'asdf',
                    db: 'my_db',
                }, 'GET', helpers_1.dbFixture('selectFromOne'));
                return influx.query(['select * from series_0'], {
                    precision: 'n',
                    retentionPolicy: 'asdf',
                });
            });
        });
        describe('.createRetentionPolicy', function () {
            beforeEach(function () { return setDefaultDB('my_db'); });
            it('creates non-default policies', function () {
                expectQuery('json', 'create retention policy "7d\\"" on "test" ' +
                    'duration 7d replication 1');
                return influx.createRetentionPolicy('7d"', {
                    database: 'test',
                    duration: '7d',
                    replication: 1,
                });
            });
            it('creates default policies', function () {
                expectQuery('json', 'create retention policy "7d\\"" on "my_db" ' +
                    'duration 7d replication 1 default');
                return influx.createRetentionPolicy('7d"', {
                    duration: '7d',
                    replication: 1,
                    isDefault: true,
                });
            });
        });
        describe('.alterRetentionPolicy', function () {
            beforeEach(function () { return setDefaultDB('my_db'); });
            it('creates non-default policies', function () {
                expectQuery('json', 'alter retention policy "7d\\"" on "test" ' +
                    'duration 7d replication 1');
                return influx.alterRetentionPolicy('7d"', {
                    database: 'test',
                    duration: '7d',
                    replication: 1,
                });
            });
            it('creates default policies', function () {
                expectQuery('json', 'alter retention policy "7d\\"" on "my_db" ' +
                    'duration 7d replication 1 default');
                return influx.alterRetentionPolicy('7d"', {
                    duration: '7d',
                    replication: 1,
                    isDefault: true,
                });
            });
        });
        it('drops retention policies', function () {
            setDefaultDB('my_db');
            expectQuery('json', 'drop retention policy "7d\\"" on "my_db"');
            return influx.dropRetentionPolicy('7d"');
        });
        it('shows retention policies', function () {
            var data = helpers_1.dbFixture('showRetentionPolicies');
            expectQuery('json', 'show retention policies on "my\\"db"', 'GET', data);
            influx.showRetentionPolicies('my"db');
            setDefaultDB('my_db');
            expectQuery('json', 'show retention policies on "my_db"', 'GET', data);
            return influx.showRetentionPolicies().then(function (res) {
                chai_1.expect(res.slice()).to.deep.equal([
                    {
                        name: 'autogen',
                        duration: '0s',
                        shardGroupDuration: '168h0m0s',
                        replicaN: 1,
                        default: true,
                    },
                    {
                        name: '7d',
                        duration: '168h0m0s',
                        shardGroupDuration: '24h0m0s',
                        replicaN: 1,
                        default: false,
                    },
                ]);
            });
        });
    });
});
