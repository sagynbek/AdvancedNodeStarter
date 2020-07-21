const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys = require('../config/keys');

const client = redis.createClient(keys.redisUrl);

client.hget = util.promisify(client.hget);

const execOriginal = mongoose.Query.prototype.exec;



mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");

  return this;
}

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return execOriginal.apply(this, arguments);
  }

  const key = JSON.stringify(Object.assign({}, this.getQuery(), {
    collection: this.mongooseCollection.name
  }));

  const cacheValue = await client.hget(this.hashKey, key);

  if (cacheValue) {
    console.log("Using cache value");
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map(item => new this.model(item))
      : new this.model(doc);
  }

  const result = await execOriginal.apply(this, arguments);

  client.hset(this.hashKey, key, JSON.stringify(result), () => { });

  return result;
}


function clearHash(hashKey) {
  client.del(JSON.stringify(hashKey));
}

module.exports = {
  clearHash,
}