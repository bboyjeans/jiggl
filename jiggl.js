#!/usr/bin/env node

var http = require("http");
var https = require('https');
var fs = require('fs');
var rest = require('restler');

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


//instanciate services
var jira_service = new JiraService(config.jira_user , config.jira_pass);
var toggl_service = new TogglService(config.toggl_api_token , 'api_token');


//get all jira issues...
jira_service.get_issues(config.jira_project).on('complete', function(data, response) {

	if(response.statusCode === 200) {
		data.issues.forEach(function(issue) {
			var task_name = [issue.key, ' - ', issue.fields.summary].join('');
			console.log('Creating Toggl task: ' + task_name);

			toggl_service.create_task(config.toggl_project_id, task_name).on('complete', function(data, response) {
				if(response.statusCode ===  200) {
					var task = data.data;
					console.log('Task Created', task.id);
				}
				else {
					console.log('Toggl task could not be created: ', data);
				}
			}).on('error', function(data) {
				console.log('Toggl task could not be created: ', data);
			});
		});
	}
	else {
		console.log('Jira issues could not be collected', data);
	}

}).on('error', function(data) {
	console.log('Jira issues could not be collected', data);
});