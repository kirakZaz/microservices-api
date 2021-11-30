module.exports = {
	"ecmaFeatures": {
		"modules": true,
		"spread" : true,
		"restParams" : true,
		"jsx": true
	},
	"env" : {
		"browser" : true,
		"node" : true,
		"es6" : true
	},
	"parserOptions": {
		"parser": "babel-eslint",
		"ecmaVersion": 2020,
		"sourceType": "module",
		"ecmaFeatures": {
			"jsx": true,
			"modules": true,
			"experimentalObjectRestSpread": true
		}
	},
	"rules": {
		"indent": [
			"warn",
			"tab",
			{ "SwitchCase": 1 }
		],
		"quotes": [
			"warn",
			"double"
		],
		"semi": [
			"error",
			"always"
		],
		"no-var": [
			"error"
		],
		"no-console": [
			"off"
		],
		"no-unused-vars": [
			"warn"
		],
		"no-mixed-spaces-and-tabs": [
			"warn"
		]
	}
};
