"use strict";
exports.__esModule = true;
var messages;
(function (messages) {
    messages["compilationComplete"] = "Webpack compilation complete.";
    messages["startWatching"] = "Webpack compilation complete. Watching for file changes.";
    messages["changeDetected"] = "File change detected. Starting incremental webpack compilation...";
})(messages = exports.messages || (exports.messages = {}));
/**
 * This little plugin will report the webpack state through the console.
 * So the {N} CLI can get some idea when compilation completes.
 */
var WatchStateLoggerPlugin = /** @class */ (function () {
    function WatchStateLoggerPlugin() {
    }
    WatchStateLoggerPlugin.prototype.apply = function (compiler) {
        var plugin = this;
        compiler.plugin("watch-run", function (compiler, callback) {
            plugin.isRunningWatching = true;
            if (plugin.isRunningWatching) {
                console.log(messages.changeDetected);
            }
            process.send && process.send(messages.changeDetected, function (error) { return null; });
            callback();
        });
        compiler.plugin("after-emit", function (compilation, callback) {
            callback();
            if (plugin.isRunningWatching) {
                console.log(messages.startWatching);
            }
            else {
                console.log(messages.compilationComplete);
            }
            var emittedFiles = Object
                .keys(compilation.assets)
                .filter(function (assetKey) { return compilation.assets[assetKey].emitted; });
            process.send && process.send(messages.compilationComplete, function (error) { return null; });
            // Send emitted files so they can be LiveSynced if need be
            process.send && process.send({ emittedFiles: emittedFiles }, function (error) { return null; });
        });
    };
    return WatchStateLoggerPlugin;
}());
exports.WatchStateLoggerPlugin = WatchStateLoggerPlugin;
