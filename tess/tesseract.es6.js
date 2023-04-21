/* eslint-disable */
function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var tesseract_min = createCommonjsModule(function (module, exports) {
!function(e,t){module.exports=t();}(window,(function(){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n});},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0});},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=7)}([function(e,t){e.exports=function(e,t){return "".concat(e,"-").concat(t,"-").concat(Math.random().toString(16).slice(3,8))};},function(e,t){var r=this,n=!1;t.logging=n,t.setLogging=function(e){n=e;},t.log=function(){for(var e=arguments.length,t=new Array(e),o=0;o<e;o++)t[o]=arguments[o];return n?console.log.apply(r,t):null};},function(e,t){var r,n,o=e.exports={};function i(){throw new Error("setTimeout has not been defined")}function a(){throw new Error("clearTimeout has not been defined")}function c(e){if(r===setTimeout)return setTimeout(e,0);if((r===i||!r)&&setTimeout)return r=setTimeout,setTimeout(e,0);try{return r(e,0)}catch(t){try{return r.call(null,e,0)}catch(t){return r.call(this,e,0)}}}!function(){try{r="function"==typeof setTimeout?setTimeout:i;}catch(e){r=i;}try{n="function"==typeof clearTimeout?clearTimeout:a;}catch(e){n=a;}}();var u,s=[],l=!1,f=-1;function p(){l&&u&&(l=!1,u.length?s=u.concat(s):f=-1,s.length&&d());}function d(){if(!l){var e=c(p);l=!0;for(var t=s.length;t;){for(u=s,s=[];++f<t;)u&&u[f].run();f=-1,t=s.length;}u=null,l=!1,function(e){if(n===clearTimeout)return clearTimeout(e);if((n===a||!n)&&clearTimeout)return n=clearTimeout,clearTimeout(e);try{n(e);}catch(t){try{return n.call(null,e)}catch(t){return n.call(this,e)}}}(e);}}function h(e,t){this.fun=e,this.array=t;}function y(){}o.nextTick=function(e){var t=new Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];s.push(new h(e,t)),1!==s.length||l||c(d);},h.prototype.run=function(){this.fun.apply(null,this.array);},o.title="browser",o.browser=!0,o.env={},o.argv=[],o.version="",o.versions={},o.on=y,o.addListener=y,o.once=y,o.off=y,o.removeListener=y,o.removeAllListeners=y,o.emit=y,o.prependListener=y,o.prependOnceListener=y,o.listeners=function(e){return []},o.binding=function(e){throw new Error("process.binding is not supported")},o.cwd=function(){return "/"},o.chdir=function(e){throw new Error("process.chdir is not supported")},o.umask=function(){return 0};},function(e,t,r){var n,o;void 0===(o="function"==typeof(n=function(){return function(){var e=arguments.length;if(0===e)throw new Error("resolveUrl requires at least one argument; got none.");var t=document.createElement("base");if(t.href=arguments[0],1===e)return t.href;var r=document.getElementsByTagName("head")[0];r.insertBefore(t,r.firstChild);for(var n,o=document.createElement("a"),i=1;i<e;i++)o.href=arguments[i],n=o.href,t.href=n;return r.removeChild(t),n}})?n.call(t,r,t,e):n)||(e.exports=o);},function(e,t,r){var n=r(0),o=0;e.exports=function(e){var t=e.id,r=e.action,i=e.payload,a=void 0===i?{}:i,c=t;return void 0===c&&(c=n("Job",o),o+=1),{id:c,action:r,payload:a}};},function(e,t,r){function n(e,t,r,n,o,i,a){try{var c=e[i](a),u=c.value;}catch(e){return void r(e)}c.done?t(u):Promise.resolve(u).then(n,o);}function o(e){return function(){var t=this,r=arguments;return new Promise((function(o,i){var a=e.apply(t,r);function c(e){n(a,o,i,c,u,"next",e);}function u(e){n(a,o,i,c,u,"throw",e);}c(void 0);}))}}function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n);}return r}function a(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){c(e,t,r[t]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t));}));}return e}function c(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function u(e,t){if(null==e)return {};var r,n,o=function(e,t){if(null==e)return {};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r]);}return o}var s=r(11),l=r(14),f=r(4),p=r(1).log,d=r(0),h=r(15).defaultOEM,y=r(16),g=y.defaultOptions,v=y.spawnWorker,m=y.terminateWorker,b=y.onMessage,w=y.loadImage,O=y.send,j=0;e.exports=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=d("Worker",j),r=s(a({},g,{},e)),n=r.logger,i=r.errorHandler,c=u(r,["logger","errorHandler"]),y={},x={},k=v(c);j+=1;var S=function(e,t){y[e]=t;},P=function(e,t){x[e]=t;},E=function(e){var r=e.id,n=e.action,o=e.payload;return new Promise((function(e,i){p("[".concat(t,"]: Start ").concat(r,", action=").concat(n)),S(n,e),P(n,i),O(k,{workerId:t,jobId:r,action:n,payload:o});}))},L=function(e){return E(f({id:e,action:"load",payload:{options:c}}))},R=function(e,t,r){return E(f({id:r,action:"FS",payload:{method:"writeFile",args:[e,t]}}))},A=function(e,t){return E(f({id:t,action:"FS",payload:{method:"readFile",args:[e,{encoding:"utf8"}]}}))},T=function(e,t){return E(f({id:t,action:"FS",payload:{method:"unlink",args:[e]}}))},_=function(e,t,r){return E(f({id:r,action:"FS",payload:{method:e,args:t}}))},N=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"eng",t=arguments.length>1?arguments[1]:void 0;return E(f({id:t,action:"loadLanguage",payload:{langs:e,options:c}}))},D=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"eng",t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:h,r=arguments.length>2?arguments[2]:void 0;return E(f({id:r,action:"initialize",payload:{langs:e,oem:t}}))},I=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"eng",t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:h,r=arguments.length>2?arguments[2]:void 0;return E(f({id:r,action:"initializeMin",payload:{langs:e,oem:t}}))},M=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1?arguments[1]:void 0;return E(f({id:t,action:"setParameters",payload:{params:e}}))},F=function(){var e=o(regeneratorRuntime.mark((function e(t){var r,n,o,i=arguments;return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return r=i.length>1&&void 0!==i[1]?i[1]:{},n=i.length>2&&void 0!==i[2]?i[2]:{},o=i.length>3?i[3]:void 0,e.t0=E,e.t1=f,e.t2=o,e.next=8,w(t);case 8:return e.t3=e.sent,e.t4=r,e.t5=n,e.t6={image:e.t3,options:e.t4,params:e.t5},e.t7={id:e.t2,action:"recognize",payload:e.t6},e.t8=(0, e.t1)(e.t7),e.abrupt("return",(0, e.t0)(e.t8));case 15:case"end":return e.stop()}}),e)})));return function(t){return e.apply(this,arguments)}}(),U=function(){var e=o(regeneratorRuntime.mark((function e(t){var r,n,o,i=arguments;return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return r=i.length>1&&void 0!==i[1]?i[1]:{},n=i.length>2&&void 0!==i[2]?i[2]:{},o=i.length>3?i[3]:void 0,e.t0=E,e.t1=f,e.t2=o,e.next=8,w(t);case 8:return e.t3=e.sent,e.t4=r,e.t5=n,e.t6={image:e.t3,options:e.t4,params:e.t5},e.t7={id:e.t2,action:"threshold",payload:e.t6},e.t8=(0, e.t1)(e.t7),e.abrupt("return",(0, e.t0)(e.t8));case 15:case"end":return e.stop()}}),e)})));return function(t){return e.apply(this,arguments)}}(),C=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"Tesseract OCR Result",t=arguments.length>1&&void 0!==arguments[1]&&arguments[1],r=arguments.length>2?arguments[2]:void 0;return E(f({id:r,action:"getPDF",payload:{title:e,textonly:t}}))},G=function(){var e=o(regeneratorRuntime.mark((function e(t,r){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.t0=E,e.t1=f,e.t2=r,e.next=5,w(t);case 5:return e.t3=e.sent,e.t4={image:e.t3},e.t5={id:e.t2,action:"detect",payload:e.t4},e.t6=(0, e.t1)(e.t5),e.abrupt("return",(0, e.t0)(e.t6));case 10:case"end":return e.stop()}}),e)})));return function(t,r){return e.apply(this,arguments)}}(),z=function(){var e=o(regeneratorRuntime.mark((function e(){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return null!==k&&(m(k),k=null),e.abrupt("return",Promise.resolve());case 2:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}}();return b(k,(function(e){var t=e.workerId,r=e.jobId,o=e.status,c=e.action,u=e.data;if("resolve"===o){p("[".concat(t,"]: Complete ").concat(r));var s=u;"recognize"===c?s=l(u):"getPDF"===c&&(s=Array.from(a({},u,{length:Object.keys(u).length}))),y[c]({jobId:r,data:s});}else if("reject"===o){if(x[c](u),!i)throw Error(u);i(u);}else "progress"===o&&n(a({},u,{userJobId:r}));})),{id:t,worker:k,setResolve:S,setReject:P,load:L,writeText:R,readText:A,removeFile:T,FS:_,loadLanguage:N,initialize:D,initializeMin:I,setParameters:M,recognize:F,threshold:U,getPDF:C,detect:G,terminate:z}};},function(e,t){e.exports={TESSERACT_ONLY:0,LSTM_ONLY:1,TESSERACT_LSTM_COMBINED:2,DEFAULT:3};},function(e,t,r){function n(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n);}return r}function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}r(8);var i=r(10),a=r(5),c=r(25),u=r(26),s=r(6),l=r(27),f=r(1).setLogging;e.exports=function(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?n(Object(r),!0).forEach((function(t){o(e,t,r[t]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):n(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t));}));}return e}({languages:u,OEM:s,PSM:l,createScheduler:i,createWorker:a,setLogging:f},c);},function(e,t,r){(function(e){function t(e){return (t="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}var r=function(e){var r=Object.prototype,n=r.hasOwnProperty,o="function"==typeof Symbol?Symbol:{},i=o.iterator||"@@iterator",a=o.asyncIterator||"@@asyncIterator",c=o.toStringTag||"@@toStringTag";function u(e,t,r,n){var o=t&&t.prototype instanceof f?t:f,i=Object.create(o.prototype),a=new x(n||[]);return i._invoke=function(e,t,r){var n="suspendedStart";return function(o,i){if("executing"===n)throw new Error("Generator is already running");if("completed"===n){if("throw"===o)throw i;return S()}for(r.method=o,r.arg=i;;){var a=r.delegate;if(a){var c=w(a,r);if(c){if(c===l)continue;return c}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if("suspendedStart"===n)throw n="completed",r.arg;r.dispatchException(r.arg);}else "return"===r.method&&r.abrupt("return",r.arg);n="executing";var u=s(e,t,r);if("normal"===u.type){if(n=r.done?"completed":"suspendedYield",u.arg===l)continue;return {value:u.arg,done:r.done}}"throw"===u.type&&(n="completed",r.method="throw",r.arg=u.arg);}}}(e,r,a),i}function s(e,t,r){try{return {type:"normal",arg:e.call(t,r)}}catch(e){return {type:"throw",arg:e}}}e.wrap=u;var l={};function f(){}function p(){}function d(){}var h={};h[i]=function(){return this};var y=Object.getPrototypeOf,g=y&&y(y(k([])));g&&g!==r&&n.call(g,i)&&(h=g);var v=d.prototype=f.prototype=Object.create(h);function m(e){["next","throw","return"].forEach((function(t){e[t]=function(e){return this._invoke(t,e)};}));}function b(e){var r;this._invoke=function(o,i){function a(){return new Promise((function(r,a){!function r(o,i,a,c){var u=s(e[o],e,i);if("throw"!==u.type){var l=u.arg,f=l.value;return f&&"object"===t(f)&&n.call(f,"__await")?Promise.resolve(f.__await).then((function(e){r("next",e,a,c);}),(function(e){r("throw",e,a,c);})):Promise.resolve(f).then((function(e){l.value=e,a(l);}),(function(e){return r("throw",e,a,c)}))}c(u.arg);}(o,i,r,a);}))}return r=r?r.then(a,a):a()};}function w(e,t){var r=e.iterator[t.method];if(void 0===r){if(t.delegate=null,"throw"===t.method){if(e.iterator.return&&(t.method="return",t.arg=void 0,w(e,t),"throw"===t.method))return l;t.method="throw",t.arg=new TypeError("The iterator does not provide a 'throw' method");}return l}var n=s(r,e.iterator,t.arg);if("throw"===n.type)return t.method="throw",t.arg=n.arg,t.delegate=null,l;var o=n.arg;return o?o.done?(t[e.resultName]=o.value,t.next=e.nextLoc,"return"!==t.method&&(t.method="next",t.arg=void 0),t.delegate=null,l):o:(t.method="throw",t.arg=new TypeError("iterator result is not an object"),t.delegate=null,l)}function O(e){var t={tryLoc:e[0]};1 in e&&(t.catchLoc=e[1]),2 in e&&(t.finallyLoc=e[2],t.afterLoc=e[3]),this.tryEntries.push(t);}function j(e){var t=e.completion||{};t.type="normal",delete t.arg,e.completion=t;}function x(e){this.tryEntries=[{tryLoc:"root"}],e.forEach(O,this),this.reset(!0);}function k(e){if(e){var t=e[i];if(t)return t.call(e);if("function"==typeof e.next)return e;if(!isNaN(e.length)){var r=-1,o=function t(){for(;++r<e.length;)if(n.call(e,r))return t.value=e[r],t.done=!1,t;return t.value=void 0,t.done=!0,t};return o.next=o}}return {next:S}}function S(){return {value:void 0,done:!0}}return p.prototype=v.constructor=d,d.constructor=p,d[c]=p.displayName="GeneratorFunction",e.isGeneratorFunction=function(e){var t="function"==typeof e&&e.constructor;return !!t&&(t===p||"GeneratorFunction"===(t.displayName||t.name))},e.mark=function(e){return Object.setPrototypeOf?Object.setPrototypeOf(e,d):(e.__proto__=d,c in e||(e[c]="GeneratorFunction")),e.prototype=Object.create(v),e},e.awrap=function(e){return {__await:e}},m(b.prototype),b.prototype[a]=function(){return this},e.AsyncIterator=b,e.async=function(t,r,n,o){var i=new b(u(t,r,n,o));return e.isGeneratorFunction(r)?i:i.next().then((function(e){return e.done?e.value:i.next()}))},m(v),v[c]="Generator",v[i]=function(){return this},v.toString=function(){return "[object Generator]"},e.keys=function(e){var t=[];for(var r in e)t.push(r);return t.reverse(),function r(){for(;t.length;){var n=t.pop();if(n in e)return r.value=n,r.done=!1,r}return r.done=!0,r}},e.values=k,x.prototype={constructor:x,reset:function(e){if(this.prev=0,this.next=0,this.sent=this._sent=void 0,this.done=!1,this.delegate=null,this.method="next",this.arg=void 0,this.tryEntries.forEach(j),!e)for(var t in this)"t"===t.charAt(0)&&n.call(this,t)&&!isNaN(+t.slice(1))&&(this[t]=void 0);},stop:function(){this.done=!0;var e=this.tryEntries[0].completion;if("throw"===e.type)throw e.arg;return this.rval},dispatchException:function(e){if(this.done)throw e;var t=this;function r(r,n){return a.type="throw",a.arg=e,t.next=r,n&&(t.method="next",t.arg=void 0),!!n}for(var o=this.tryEntries.length-1;o>=0;--o){var i=this.tryEntries[o],a=i.completion;if("root"===i.tryLoc)return r("end");if(i.tryLoc<=this.prev){var c=n.call(i,"catchLoc"),u=n.call(i,"finallyLoc");if(c&&u){if(this.prev<i.catchLoc)return r(i.catchLoc,!0);if(this.prev<i.finallyLoc)return r(i.finallyLoc)}else if(c){if(this.prev<i.catchLoc)return r(i.catchLoc,!0)}else {if(!u)throw new Error("try statement without catch or finally");if(this.prev<i.finallyLoc)return r(i.finallyLoc)}}}},abrupt:function(e,t){for(var r=this.tryEntries.length-1;r>=0;--r){var o=this.tryEntries[r];if(o.tryLoc<=this.prev&&n.call(o,"finallyLoc")&&this.prev<o.finallyLoc){var i=o;break}}i&&("break"===e||"continue"===e)&&i.tryLoc<=t&&t<=i.finallyLoc&&(i=null);var a=i?i.completion:{};return a.type=e,a.arg=t,i?(this.method="next",this.next=i.finallyLoc,l):this.complete(a)},complete:function(e,t){if("throw"===e.type)throw e.arg;return "break"===e.type||"continue"===e.type?this.next=e.arg:"return"===e.type?(this.rval=this.arg=e.arg,this.method="return",this.next="end"):"normal"===e.type&&t&&(this.next=t),l},finish:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var r=this.tryEntries[t];if(r.finallyLoc===e)return this.complete(r.completion,r.afterLoc),j(r),l}},catch:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var r=this.tryEntries[t];if(r.tryLoc===e){var n=r.completion;if("throw"===n.type){var o=n.arg;j(r);}return o}}throw new Error("illegal catch attempt")},delegateYield:function(e,t,r){return this.delegate={iterator:k(e),resultName:t,nextLoc:r},"next"===this.method&&(this.arg=void 0),l}},e}("object"===t(e)?e.exports:{});try{regeneratorRuntime=r;}catch(e){Function("r","regeneratorRuntime = r")(r);}}).call(this,r(9)(e));},function(e,t){e.exports=function(e){return e.webpackPolyfill||(e.deprecate=function(){},e.paths=[],e.children||(e.children=[]),Object.defineProperty(e,"loaded",{enumerable:!0,get:function(){return e.l}}),Object.defineProperty(e,"id",{enumerable:!0,get:function(){return e.i}}),e.webpackPolyfill=1),e};},function(e,t,r){var n=this;function o(e){return function(e){if(Array.isArray(e)){for(var t=0,r=new Array(e.length);t<e.length;t++)r[t]=e[t];return r}}(e)||function(e){if(Symbol.iterator in Object(e)||"[object Arguments]"===Object.prototype.toString.call(e))return Array.from(e)}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance")}()}function i(e,t,r,n,o,i,a){try{var c=e[i](a),u=c.value;}catch(e){return void r(e)}c.done?t(u):Promise.resolve(u).then(n,o);}function a(e){return function(){var t=this,r=arguments;return new Promise((function(n,o){var a=e.apply(t,r);function c(e){i(a,n,o,c,u,"next",e);}function u(e){i(a,n,o,c,u,"throw",e);}c(void 0);}))}}var c=r(4),u=r(1).log,s=r(0),l=0;e.exports=function(){var e=s("Scheduler",l),t={},r={},i=[];l+=1;var f=function(){return Object.keys(t).length},p=function(){if(0!==i.length)for(var e=Object.keys(t),n=0;n<e.length;n+=1)if(void 0===r[e[n]]){i[0](t[e[n]]);break}},d=function(t,s){return new Promise((function(l,f){var d=c({action:t,payload:s});i.push(function(){var e=a(regeneratorRuntime.mark((function e(a){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return i.shift(),r[a.id]=d,e.prev=2,e.t0=l,e.next=6,a[t].apply(n,[].concat(o(s),[d.id]));case 6:e.t1=e.sent,(0, e.t0)(e.t1),e.next=13;break;case 10:e.prev=10,e.t2=e.catch(2),f(e.t2);case 13:return e.prev=13,delete r[a.id],p(),e.finish(13);case 17:case"end":return e.stop()}}),e,null,[[2,10,13,17]])})));return function(t){return e.apply(this,arguments)}}()),u("[".concat(e,"]: Add ").concat(d.id," to JobQueue")),u("[".concat(e,"]: JobQueue length=").concat(i.length)),p();}))};return {addWorker:function(r){return t[r.id]=r,u("[".concat(e,"]: Add ").concat(r.id)),u("[".concat(e,"]: Number of workers=").concat(f())),p(),r.id},addJob:function(){var t=a(regeneratorRuntime.mark((function t(r){var n,o,i,a=arguments;return regeneratorRuntime.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(0!==f()){t.next=2;break}throw Error("[".concat(e,"]: You need to have at least one worker before adding jobs"));case 2:for(n=a.length,o=new Array(n>1?n-1:0),i=1;i<n;i++)o[i-1]=a[i];return t.abrupt("return",d(r,o));case 4:case"end":return t.stop()}}),t)})));return function(e){return t.apply(this,arguments)}}(),terminate:function(){var e=a(regeneratorRuntime.mark((function e(){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:Object.keys(t).forEach(function(){var e=a(regeneratorRuntime.mark((function e(r){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,t[r].terminate();case 2:case"end":return e.stop()}}),e)})));return function(t){return e.apply(this,arguments)}}()),i=[];case 2:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}}(),getQueueLen:function(){return i.length},getNumWorkers:f}};},function(e,t,r){function n(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n);}return r}function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var i="browser"===r(12)("type")?r(3):function(e){return e};e.exports=function(e){var t=function(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?n(Object(r),!0).forEach((function(t){o(e,t,r[t]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):n(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t));}));}return e}({},e);return ["corePath","workerPath","langPath"].forEach((function(r){void 0!==e[r]&&(t[r]=i(t[r]));})),t};},function(e,t,r){(function(t){function n(e){return (n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}var o=r(13);e.exports=function(e){var r={};return "undefined"!=typeof WorkerGlobalScope?r.type="webworker":o()?r.type="electron":"object"===("undefined"==typeof window?"undefined":n(window))?r.type="browser":"object"===(void 0===t?"undefined":n(t))&&(r.type="node"),void 0===e?r:r[e]};}).call(this,r(2));},function(e,t,r){(function(t){function r(e){return (r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}e.exports=function(){return "undefined"!=typeof window&&"object"===r(window.process)&&"renderer"===window.process.type||(!(void 0===t||"object"!==r(t.versions)||!t.versions.electron)||"object"===("undefined"==typeof navigator?"undefined":r(navigator))&&"string"==typeof navigator.userAgent&&navigator.userAgent.indexOf("Electron")>=0)};}).call(this,r(2));},function(e,t){function r(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n);}return r}function n(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){o(e,t,n[t]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t));}));}return e}function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}e.exports=function(e){if(!e.blocks)return e;var t=[],r=[],o=[],i=[],a=[];return e.blocks.forEach((function(c){c.paragraphs.forEach((function(t){t.lines.forEach((function(r){r.words.forEach((function(o){o.symbols.forEach((function(i){a.push(n({},i,{page:e,block:c,paragraph:t,line:r,word:o}));})),i.push(n({},o,{page:e,block:c,paragraph:t,line:r}));})),o.push(n({},r,{page:e,block:c,paragraph:t}));})),r.push(n({},t,{page:e,block:c}));})),t.push(n({},c,{page:e}));})),n({},e,{blocks:t,paragraphs:r,lines:o,words:i,symbols:a})};},function(e,t,r){var n=r(6);e.exports={defaultOEM:n.DEFAULT};},function(e,t,r){var n=r(17),o=r(20),i=r(21),a=r(22),c=r(23),u=r(24);e.exports={defaultOptions:n,spawnWorker:o,terminateWorker:i,onMessage:a,send:c,loadImage:u};},function(e,t,r){(function(t){function n(e){return (n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n);}return r}function i(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var a=r(3),c=r(18),u=c.version,s=c.dependencies,l=r(19);e.exports=function(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){i(e,t,r[t]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t));}));}return e}({},l,{workerPath:void 0!==t&&"development"===t.env.TESS_ENV?a("/dist/worker.dev.js?nocache=".concat(Math.random().toString(36).slice(3))):"https://unpkg.com/tesseract.js@v".concat(u,"/dist/worker.min.js"),corePath:"https://unpkg.com/tesseract.js-core@v".concat(s["tesseract.js-core"].substring(1),"/tesseract-core.").concat("object"===("undefined"==typeof WebAssembly?"undefined":n(WebAssembly))?"wasm":"asm",".js")});}).call(this,r(2));},function(e){e.exports=JSON.parse('{"name":"tesseract.js","version":"2.1.5","description":"Pure Javascript Multilingual OCR","main":"src/index.js","types":"src/index.d.ts","unpkg":"dist/tesseract.min.js","jsdelivr":"dist/tesseract.min.js","scripts":{"start":"node scripts/server.js","build":"rimraf dist && webpack --config scripts/webpack.config.prod.js","build-dev":"rimraf dev && webpack --config scripts/webpack.config.dev.js","build-es6":"npm run build && rollup -c scripts/rollup.es6.js","build-es6-dev":"npm run build-dev && rollup -c scripts/rollup-dev.es6.js","profile:tesseract":"webpack-bundle-analyzer dist/tesseract-stats.json","profile:worker":"webpack-bundle-analyzer dist/worker-stats.json","prepublishOnly":"npm run build","wait":"rimraf dist && wait-on http://localhost:3000/dist/tesseract.dev.js","test":"npm-run-all -p -r start test:all","test:all":"npm-run-all wait test:browser:* test:node:all","test:node":"nyc mocha --exit --bail --require ./scripts/test-helper.js","test:node:all":"npm run test:node -- ./tests/*.test.js","test:browser-tpl":"mocha-headless-chrome -a incognito -a no-sandbox -a disable-setuid-sandbox -a disable-logging -t 300000","test:browser:detect":"npm run test:browser-tpl -- -f ./tests/detect.test.html","test:browser:recognize":"npm run test:browser-tpl -- -f ./tests/recognize.test.html","test:browser:scheduler":"npm run test:browser-tpl -- -f ./tests/scheduler.test.html","test:browser:FS":"npm run test:browser-tpl -- -f ./tests/FS.test.html","lint":"eslint src","lint:fix":"eslint --fix src","postinstall":"opencollective-postinstall || true"},"browser":{"./src/worker/node/index.js":"./src/worker/browser/index.js"},"author":"","contributors":["jeromewu"],"license":"Apache-2.0","devDependencies":{"@babel/core":"^7.7.7","@babel/preset-env":"^7.7.7","acorn":"^6.4.0","babel-loader":"^8.1.0","cors":"^2.8.5","eslint":"^7.2.0","eslint-config-airbnb-base":"^14.2.0","eslint-plugin-import":"^2.22.1","expect.js":"^0.3.1","express":"^4.17.1","mocha":"^8.1.3","mocha-headless-chrome":"^2.0.3","npm-run-all":"^4.1.5","nyc":"^15.1.0","rimraf":"^2.7.1","rollup":"^2.21.0","rollup-plugin-commonjs":"^10.1.0","wait-on":"^3.3.0","webpack":"^4.44.2","webpack-bundle-analyzer":"^3.6.0","webpack-cli":"^3.3.12","webpack-dev-middleware":"^3.7.2"},"dependencies":{"blueimp-load-image":"^3.0.0","bmp-js":"^0.1.0","file-type":"^12.4.1","idb-keyval":"^3.2.0","is-electron":"^2.2.0","is-url":"^1.2.4","jpeg-autorotate":"^7.1.1","node-fetch":"^2.6.0","opencollective-postinstall":"^2.0.2","regenerator-runtime":"^0.13.3","resolve-url":"^0.2.1","tesseract.js-core":"^2.2.0","zlibjs":"^0.3.1"},"repository":{"type":"git","url":"https://github.com/naptha/tesseract.js.git"},"bugs":{"url":"https://github.com/naptha/tesseract.js/issues"},"homepage":"https://github.com/naptha/tesseract.js","collective":{"type":"opencollective","url":"https://opencollective.com/tesseractjs"}}');},function(e,t){e.exports={langPath:"https://tessdata.projectnaptha.com/4.0.0",workerBlobURL:!0,logger:function(){}};},function(e,t){e.exports=function(e){var t,r=e.workerPath,n=e.workerBlobURL;if(Blob&&URL&&n){var o=new Blob(['importScripts("'.concat(r,'");')],{type:"application/javascript"});t=new Worker(URL.createObjectURL(o));}else t=new Worker(r);return t};},function(e,t){e.exports=function(e){e.terminate();};},function(e,t){e.exports=function(e,t){e.onmessage=function(e){var r=e.data;t(r);};};},function(e,t){function r(e,t,r,n,o,i,a){try{var c=e[i](a),u=c.value;}catch(e){return void r(e)}c.done?t(u):Promise.resolve(u).then(n,o);}e.exports=function(){var e,t=(e=regeneratorRuntime.mark((function e(t,r){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:t.postMessage(r);case 1:case"end":return e.stop()}}),e)})),function(){var t=this,n=arguments;return new Promise((function(o,i){var a=e.apply(t,n);function c(e){r(a,o,i,c,u,"next",e);}function u(e){r(a,o,i,c,u,"throw",e);}c(void 0);}))});return function(e,r){return t.apply(this,arguments)}}();},function(e,t,r){function n(e,t,r,n,o,i,a){try{var c=e[i](a),u=c.value;}catch(e){return void r(e)}c.done?t(u):Promise.resolve(u).then(n,o);}function o(e){return function(){var t=this,r=arguments;return new Promise((function(o,i){var a=e.apply(t,r);function c(e){n(a,o,i,c,u,"next",e);}function u(e){n(a,o,i,c,u,"throw",e);}c(void 0);}))}}var i=r(3),a=function(e){return new Promise((function(t,r){var n=new FileReader;n.onload=function(){t(n.result);},n.onerror=function(e){var t=e.target.error.code;r(Error("File could not be read! Code=".concat(t)));},n.readAsArrayBuffer(e);}))},c=function(){var e=o(regeneratorRuntime.mark((function e(t){var r,n;return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(r=t,void 0!==t){e.next=3;break}return e.abrupt("return","undefined");case 3:if("string"!=typeof t){e.next=16;break}if(!/data:image\/([a-zA-Z]*);base64,([^"]*)/.test(t)){e.next=8;break}r=atob(t.split(",")[1]).split("").map((function(e){return e.charCodeAt(0)})),e.next=14;break;case 8:return e.next=10,fetch(i(t));case 10:return n=e.sent,e.next=13,n.arrayBuffer();case 13:r=e.sent;case 14:e.next=34;break;case 16:if(!(t instanceof HTMLElement)){e.next=30;break}if("IMG"!==t.tagName){e.next=21;break}return e.next=20,c(t.src);case 20:r=e.sent;case 21:if("VIDEO"!==t.tagName){e.next=25;break}return e.next=24,c(t.poster);case 24:r=e.sent;case 25:if("CANVAS"!==t.tagName){e.next=28;break}return e.next=28,new Promise((function(e){t.toBlob(function(){var t=o(regeneratorRuntime.mark((function t(n){return regeneratorRuntime.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,a(n);case 2:r=t.sent,e();case 4:case"end":return t.stop()}}),t)})));return function(e){return t.apply(this,arguments)}}());}));case 28:e.next=34;break;case 30:if(!(t instanceof File||t instanceof Blob)){e.next=34;break}return e.next=33,a(t);case 33:r=e.sent;case 34:return e.abrupt("return",new Uint8Array(r));case 35:case"end":return e.stop()}}),e)})));return function(t){return e.apply(this,arguments)}}();e.exports=c;},function(e,t,r){function n(e,t,r,n,o,i,a){try{var c=e[i](a),u=c.value;}catch(e){return void r(e)}c.done?t(u):Promise.resolve(u).then(n,o);}function o(e){return function(){var t=this,r=arguments;return new Promise((function(o,i){var a=e.apply(t,r);function c(e){n(a,o,i,c,u,"next",e);}function u(e){n(a,o,i,c,u,"throw",e);}c(void 0);}))}}var i=r(5),a=function(){var e=o(regeneratorRuntime.mark((function e(t,r,n){var a;return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return a=i(n),e.next=3,a.load();case 3:return e.next=5,a.loadLanguage(r);case 5:return e.next=7,a.initialize(r);case 7:return e.abrupt("return",a.recognize(t).finally(o(regeneratorRuntime.mark((function e(){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,a.terminate();case 2:case"end":return e.stop()}}),e)})))));case 8:case"end":return e.stop()}}),e)})));return function(t,r,n){return e.apply(this,arguments)}}(),c=function(){var e=o(regeneratorRuntime.mark((function e(t,r){var n;return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return n=i(r),e.next=3,n.load();case 3:return e.next=5,n.loadLanguage("osd");case 5:return e.next=7,n.initialize("osd");case 7:return e.abrupt("return",n.detect(t).finally(o(regeneratorRuntime.mark((function e(){return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,n.terminate();case 2:case"end":return e.stop()}}),e)})))));case 8:case"end":return e.stop()}}),e)})));return function(t,r){return e.apply(this,arguments)}}();e.exports={recognize:a,detect:c};},function(e,t){e.exports={AFR:"afr",AMH:"amh",ARA:"ara",ASM:"asm",AZE:"aze",AZE_CYRL:"aze_cyrl",BEL:"bel",BEN:"ben",BOD:"bod",BOS:"bos",BUL:"bul",CAT:"cat",CEB:"ceb",CES:"ces",CHI_SIM:"chi_sim",CHI_TRA:"chi_tra",CHR:"chr",CYM:"cym",DAN:"dan",DEU:"deu",DZO:"dzo",ELL:"ell",ENG:"eng",ENM:"enm",EPO:"epo",EST:"est",EUS:"eus",FAS:"fas",FIN:"fin",FRA:"fra",FRK:"frk",FRM:"frm",GLE:"gle",GLG:"glg",GRC:"grc",GUJ:"guj",HAT:"hat",HEB:"heb",HIN:"hin",HRV:"hrv",HUN:"hun",IKU:"iku",IND:"ind",ISL:"isl",ITA:"ita",ITA_OLD:"ita_old",JAV:"jav",JPN:"jpn",KAN:"kan",KAT:"kat",KAT_OLD:"kat_old",KAZ:"kaz",KHM:"khm",KIR:"kir",KOR:"kor",KUR:"kur",LAO:"lao",LAT:"lat",LAV:"lav",LIT:"lit",MAL:"mal",MAR:"mar",MKD:"mkd",MLT:"mlt",MSA:"msa",MYA:"mya",NEP:"nep",NLD:"nld",NOR:"nor",ORI:"ori",PAN:"pan",POL:"pol",POR:"por",PUS:"pus",RON:"ron",RUS:"rus",SAN:"san",SIN:"sin",SLK:"slk",SLV:"slv",SPA:"spa",SPA_OLD:"spa_old",SQI:"sqi",SRP:"srp",SRP_LATN:"srp_latn",SWA:"swa",SWE:"swe",SYR:"syr",TAM:"tam",TEL:"tel",TGK:"tgk",TGL:"tgl",THA:"tha",TIR:"tir",TUR:"tur",UIG:"uig",UKR:"ukr",URD:"urd",UZB:"uzb",UZB_CYRL:"uzb_cyrl",VIE:"vie",YID:"yid"};},function(e,t){e.exports={OSD_ONLY:"0",AUTO_OSD:"1",AUTO_ONLY:"2",AUTO:"3",SINGLE_COLUMN:"4",SINGLE_BLOCK_VERT_TEXT:"5",SINGLE_BLOCK:"6",SINGLE_LINE:"7",SINGLE_WORD:"8",CIRCLE_WORD:"9",SINGLE_CHAR:"10",SPARSE_TEXT:"11",SPARSE_TEXT_OSD:"12"};}])}));

});

var tesseract_min$1 = unwrapExports(tesseract_min);
var tesseract_min_1 = tesseract_min.Tesseract;

export { tesseract_min_1 as Tesseract, tesseract_min$1 as default };
