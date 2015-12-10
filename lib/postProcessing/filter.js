"use strict";
var filter = module.exports = { };

var _ = require("underscore");
var debug = require("../debugging.js");

filter.action = function(request, response, callback) {
  var allFilters = _.extend({ }, request.params.filter);
  if (!allFilters) return callback();

  var filters = { };
  for (var i in allFilters) {
    if (!request.resourceConfig.attributes[i]) {
      return callback({
        status: "403",
        code: "EFORBIDDEN",
        title: "Invalid filter",
        detail: request.resourceConfig.resource + " do not have property " + i
      });
    }
    if (allFilters[i] instanceof Array) {
      allFilters[i] = allFilters[i].join(",");
    }
    if (typeof allFilters[i] === "string") {
      filters[i] = allFilters[i];
    }
  }

  if (response.data instanceof Array) {
    for (var j = 0; j < response.data.length; j++) {
      if (!filter._filterKeepObject(response.data[j], filters)) {
        debug.filter("removed", filters, JSON.stringify(response.data[j].attributes));
        response.data.splice(j, 1);
        j--;
      }
    }
  } else if (response.data instanceof Object) {
    if (!filter._filterKeepObject(response.data, filters)) {
      debug.filter("removed", filters, JSON.stringify(response.data.attributes));
      response.data = null;
    }
  }

  return callback();
};

filter._filterMatches = function(textToMatch, propertyText) {
  if (textToMatch[0] === ">") {
    textToMatch = textToMatch.substring(1);
    if (typeof propertyText === "number") textToMatch = parseInt(textToMatch, 10);
    if (textToMatch < propertyText) return true;
  } else if (textToMatch[0] === "<") {
    textToMatch = textToMatch.substring(1);
    if (typeof propertyText === "number") textToMatch = parseInt(textToMatch, 10);
    if (textToMatch > propertyText) return true;
  } else if (textToMatch[0] === "~") {
    if ((textToMatch.substring(1) + "").toLowerCase() === (propertyText + "").toLowerCase()) return true;
  } else if (textToMatch[0] === ":") {
    if ((propertyText + "").toLowerCase().indexOf((textToMatch.substring(1) + "").toLowerCase()) !== -1) return true;
  } else if (textToMatch === propertyText) return true;
};

filter._filterKeepObject = function(someObject, filters) {
  for (var filterName in filters) {
    var whitelist = filters[filterName].split(",");

    if (someObject.attributes.hasOwnProperty(filterName) || (filterName === "id")) {
      var attributeValue = someObject.attributes[filterName] || "";
      if (filterName === "id") attributeValue = someObject.id;
      var attributeMatches = filter._attributesMatchesOR(attributeValue, whitelist);
      if (!attributeMatches) return false;
    }

    if (someObject.relationships.hasOwnProperty(filterName)) {
      var relationships = someObject.relationships[filterName] || "";
      var relationshipMatches = filter._relationshipMatchesOR(relationships, whitelist);
      if (!relationshipMatches) return false;
    }
  }
  return true;
};

filter._attributesMatchesOR = function(attributeValue, whitelist) {
  var matchOR = false;
  whitelist.forEach(function(textToMatch) {
    if (filter._filterMatches(textToMatch, attributeValue)) {
      matchOR = true;
    }
  });
  return matchOR;
};

filter._relationshipMatchesOR = function(relationships, whitelist) {
  var matchOR = false;

  var data = relationships.data;
  if (!data) return false;

  if (!(data instanceof Array)) data = [ data ];
  data = data.map(function(relation) {
    return relation.id;
  });

  whitelist.forEach(function(textToMatch) {
    if (data.indexOf(textToMatch) !== -1) {
      matchOR = true;
    }
  });
  return matchOR;
};
