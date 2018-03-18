/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
const Template = require("webpack/lib/Template");
const SyncWaterfallHook = require("tapable").SyncWaterfallHook;

class JsonpMainTemplatePlugin {
  apply(mainTemplate) {
    const needChunkOnDemandLoadingCode = chunk => {
      for (const chunkGroup of chunk.groupsIterable) {
        if (chunkGroup.getNumberOfChildren() > 0) return true;
      }
      return false;
    };
    const needChunkLoadingCode = chunk => {
      for (const chunkGroup of chunk.groupsIterable) {
        if (chunkGroup.chunks.length > 1) return true;
        if (chunkGroup.getNumberOfChildren() > 0) return true;
      }
      return false;
    };
    const needEntryDeferringCode = chunk => {
      for (const chunkGroup of chunk.groupsIterable) {
        if (chunkGroup.chunks.length > 1) return true;
      }
      return false;
    };
    if (!mainTemplate.hooks.jsonpScript) {
      mainTemplate.hooks.jsonpScript = new SyncWaterfallHook([
        "source",
        "chunk",
        "hash"
      ]);
    }

    mainTemplate.hooks.localVars.tap("JsonpMainTemplatePlugin", (source, chunk) => {
      if (needChunkLoadingCode(chunk)) {
        return Template.asString([
          source,
          "// objects to store loaded and loading chunks",
          "var installedChunks = {",
          Template.indent(
            chunk.ids.map(function (id) {
              return id + ": 0";
            }).join(",\n")
          ),
            "};"
        ]);
      }
      return source;
    });

    mainTemplate.hooks.requireEnsure.tap("JsonpMainTemplatePlugin", (_, chunk, hash) => {
      var chunkFilename = mainTemplate.outputOptions.chunkFilename;
      var chunkMaps = chunk.getChunkMaps();
      var insertMoreModules = [
        "var moreModules = chunk.modules, chunkIds = chunk.ids;",
        "for(var moduleId in moreModules) {",
            Template.indent(mainTemplate.renderAddModule(hash, chunk, "moduleId", "moreModules[moduleId]")),
            "}"
      ];

      var request = mainTemplate.getAssetPath(JSON.stringify("./" + chunkFilename), {
        hash: "\" + " + mainTemplate.renderCurrentHashCode(hash) + " + \"",
        hashWithLength: (length) =>
        "\" + " + mainTemplate.renderCurrentHashCode(hash, length) + " + \"",
        chunk: {
          id: "\" + chunkId + \"",
          hash: "\" + " + JSON.stringify(chunkMaps.hash) + "[chunkId] + \"",
          hashWithLength: function (length) {
            var shortChunkHashMap = {};
            Object.keys(chunkMaps.hash).forEach(function (chunkId) {
              if (typeof chunkMaps.hash[chunkId] === "string")
                shortChunkHashMap[chunkId] = chunkMaps.hash[chunkId].substr(0, length);
            });
            return "\" + " + JSON.stringify(shortChunkHashMap) + "[chunkId] + \"";
          },
          name: "\" + (" + JSON.stringify(chunkMaps.name) + "[chunkId]||chunkId) + \""
        }
      });

      return Template.asString([
        "// \"0\" is the signal for \"already loaded\"",
        "if(installedChunks[chunkId] !== 0) {",
            Template.indent([
              "var chunk = require(" + request + ");"
            ]),
            "}",
        "return Promise.resolve();"
      ]);
    });
    mainTemplate.hooks.requireExtensions.tap("JsonpMainTemplatePlugin", (source, chunk) => {
      if (!needChunkOnDemandLoadingCode(chunk)) return source;
      return Template.asString([
        source,
        "",
        "// on error function for async loading",
        this.requireFn + ".oe = function(err) { console.error(err); throw err; };"
      ]);
    });
    mainTemplate.hooks.bootstrap.tap("JsonpMainTemplatePlugin", (source, chunk, hash) => {
      if (needChunkLoadingCode(chunk)) {
        var jsonpFunction = mainTemplate.outputOptions.jsonpFunction;
        return Template.asString([
          source,
          "",
          "// install a JSONP callback for chunk loading",
          "var parentJsonpFunction = global[" + JSON.stringify(jsonpFunction) + "];",
          "global[" + JSON.stringify(jsonpFunction) + "] = function webpackJsonpCallback(chunkIds, moreModules, executeModules) {",
              Template.indent([
                "// add \"moreModules\" to the modules object,",
                "// then flag all \"chunkIds\" as loaded and fire callback",
                "var moduleId, chunkId, i = 0, resolves = [], result;",
                "for(;i < chunkIds.length; i++) {",
                    Template.indent([
                      "chunkId = chunkIds[i];",
                      "if(installedChunks[chunkId])",
                      Template.indent("resolves.push(installedChunks[chunkId][0]);"),
                      "installedChunks[chunkId] = 0;"
                    ]),
                    "}",
              "for(moduleId in moreModules) {",
                  Template.indent([
                    "if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {",
                        Template.indent(mainTemplate.renderAddModule(hash, chunk, "moduleId", "moreModules[moduleId]")),
                        "}"
                  ]),
                  "}",
              "if(parentJsonpFunction) parentJsonpFunction(chunkIds, moreModules, executeModules);",
              "while(resolves.length)",
              Template.indent("resolves.shift()();"),
              chunk.hasEntryModule() ? [
                "if(executeModules) {",
                    Template.indent([
                      "for(i=0; i < executeModules.length; i++) {",
                          Template.indent("result = " + mainTemplate.requireFn + "(" + this.requireFn + ".s = executeModules[i]);"),
                          "}"
                    ]),
                    "}",
                "return result;",
              ] : ""
              ]),
              "};"
        ]);
      }
      return source;
    });
    mainTemplate.hooks.hotBootstrap.tap("JsonpMainTemplatePlugin", (source, chunk, hash) => {
      var hotUpdateChunkFilename = mainTemplate.outputOptions.hotUpdateChunkFilename;
      var hotUpdateMainFilename = mainTemplate.outputOptions.hotUpdateMainFilename;
      var hotUpdateFunction = mainTemplate.outputOptions.hotUpdateFunction;
      var currentHotUpdateChunkFilename = mainTemplate.getAssetPath(JSON.stringify(hotUpdateChunkFilename), {
        hash: "\" + " + mainTemplate.renderCurrentHashCode(hash) + " + \"",
        hashWithLength: (length) =>
        "\" + " + this.renderCurrentHashCode(hash, length) + " + \"",
        chunk: {
          id: "\" + chunkId + \""
        }
      });
      var currentHotUpdateMainFilename = mainTemplate.getAssetPath(JSON.stringify(hotUpdateMainFilename), {
        hash: "\" + " + mainTemplate.renderCurrentHashCode(hash) + " + \"",
        hashWithLength: (length) =>
        "\" + " + mainTemplate.renderCurrentHashCode(hash, length) + " + \"",
      });

      return source + "\n" +
        "function hotDisposeChunk(chunkId) {\n" +
            "\tdelete installedChunks[chunkId];\n" +
            "}\n" +
        "var parentHotUpdateCallback = this[" + JSON.stringify(hotUpdateFunction) + "];\n" +
        "this[" + JSON.stringify(hotUpdateFunction) + "] = " + Template.getFunctionContent(require("./JsonpMainTemplate.runtime.js"))
        .replace(/\/\/\$semicolon/g, ";")
        .replace(/\$require\$/g, this.requireFn)
        .replace(/\$hotMainFilename\$/g, currentHotUpdateMainFilename)
        .replace(/\$hotChunkFilename\$/g, currentHotUpdateChunkFilename)
        .replace(/\$hash\$/g, JSON.stringify(hash));
    });
    mainTemplate.hooks.hash.tap("JsonpMainTemplatePlugin", hash => {
      hash.update("jsonp");
      hash.update("4");
      hash.update(mainTemplate.outputOptions.filename + "");
      hash.update(mainTemplate.outputOptions.chunkFilename + "");
      hash.update(mainTemplate.outputOptions.jsonpFunction + "");
      hash.update(mainTemplate.outputOptions.hotUpdateFunction + "");
    });
  }
};


module.exports = JsonpMainTemplatePlugin;
