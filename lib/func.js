/* Created by Dominik Herbst on 2016-05-15 */

/**
 * Creates a random string of given length
 * @param {Number} len
 * @return {String}
 */
exports.randomString = function (len) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomString = '';
	for (var i = 0; i < len; i++) {
		var rNum = Math.floor(Math.random() * chars.length);
		randomString += chars.substring(rNum, rNum + 1);
	}
	return randomString;
};


exports.advancedArray = function () {
    const a = [];
    a.remove = function (o) {
        const i = this.indexOf(o);
        this.splice(i, 0);
    };
    return a;
};
