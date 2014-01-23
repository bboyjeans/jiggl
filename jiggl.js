#!/usr/bin/env node

var http = require("http");
var https = require('https');
var fs = require('fs');
var rest = require('restler');
var Q = require("q");

var config = JSON.parse(fs.readFileSync('config.json'));


//Jira Service
var JiraService = rest.service(function(u, p) {
		this.defaults.username = u;
		this.defaults.password = p;
	}, {
		baseURL: ('https://' + config.jira_host)
	}, {
	get_issues: function(project_id) {
		var path = [
			'/rest/api/2/search?jql=project=',
			project_id,
			'+AND+issuetype+NOT+in%20(',
			config.jira_ignore_issue_types,
			')&fields=summary&maxResults=1000'
		].join('');

		return this.get(path);
	},
	set_toggl_id: function(issue, toggl_id) {
		var path = ('/rest/api/2/issue/' + issue);
		var data = {fields: {}};
		data.fields[config.jira_toggl_field_id] = toggl_id;

		return this.put(path, {data: JSON.stringify(data), headers:{'content-type': 'application/json'}});
	}
});


//Toggl Service
var TogglService = rest.service(function(u, p) {
		this.defaults.username = u;
		this.defaults.password = p;
	}, {
		baseURL: 'https://toggl.com'
	}, {
	create_task: function(project_id, name) {
		var path = '/api/v8/tasks';
		var data = {task:{pid: project_id, name: name}};
		return this.post(path, {data: JSON.stringify(data)});
	}
});




var app = {

	init: function() {
		this.jira_service = new JiraService(config.jira_user , config.jira_pass);
		this.toggl_service = new TogglService(config.toggl_api_token , 'api_token');

		this.get_jira_issues()
			.then(this.create_toggl_tasks)
			.fail(function(e){
				console.log('[Error] Oh crumbs: ', e);
			})
			.done(this.toggl_import_complete);
	},

	get_jira_issues: function() {
		var deferred = Q.defer();
		this.jira_service.get_issues(config.jira_project).on('complete', function(data, response) {
			if(response.statusCode === 200) {
				console.log('[Retrieved] ' + data.issues.length + ' Jira Issues');
				deferred.resolve(data.issues);
			}
			else {
				deferred.reject(new Error('Jira issues could not be collected: ' + JSON.stringify(data)));
			}
		});
		return deferred.promise;
	},

	create_toggl_tasks: function(issues) {
		return Q.all(issues.map(function(issue){
			var task_name = [issue.key, ' - ', issue.fields.summary].join('');
			return app.create_toggl_task(task_name);
		}));
	},

	create_toggl_task: function(name) {
		var deferred = Q.defer();
		this.toggl_service.create_task(config.toggl_project_id, name).on('complete', function(data, response) {
			if(response.statusCode ===  200) {
				var task = data.data;
				console.log('[Created] Toggl task ' + task.id + ' From Jira issue ' + name);

				//save jira toggl id...
				//this.jira_service.set_toggl_id('JIG-3', "12345").on('complete', function(data, response){
				//	console.log(data, response.statusCode);
				//});

				deferred.resolve(task);
			}
			else {
				deferred.reject(new Error('Toggl task (' + name + ')could not be created: ' + JSON.stringify(data)));
			}
		});
		return deferred.promise;
	},

	toggl_import_complete: function() {
		console.log("[Complete]");
	}
};


//kickoff
app.init();