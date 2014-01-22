var http = require("http");
var https = require('https');

//load config file...
var config_filename = 'config.json';
var fs = require('fs');

var config = JSON.parse(fs.readFileSync(config_filename));

// console.log(config.toggl_api_token);
// console.log(config.jira_user);
// console.log(config.jira_pass);

/*
var JiraApi = require('jira').JiraApi;
var jira = new JiraApi('https', config.jira_host, config.jira_port, config.jira_user, config.jira_pass, '2');
jira.findIssue("HVM-8", function(error, issue) {
	console.log('Status: ' + JSON.stringify(issue, null, 4));
});
*/


//toggl url for getting times
//path: '/api/v8/time_entries?start_date=2014-01-21T07%3A00%3A00%2B10%3A00&end_date=2014-01-22T07%3A00%3A00%2B10%3A00',


var toggl_options = {
	host: 'toggl.com',
	path: '/api/v8/tasks',
	port: 443,
	method: 'POST',
	headers: {
		'Authorization': 'Basic ' + new Buffer(config.toggl_api_token + ':api_token').toString('base64'),
		'Content-type': 'application/json'
	}
};


/**
 * Get Jira Issues
 */

 // /&fields=key,summary,type,customfield_10103

var jira_options = {
	host: 'inoutput.atlassian.net',
	path: '/rest/api/2/search?jql=project='+config.jira_project+'+AND+issuetype+NOT+in%20('+config.jira_ignore_issue_types+')&maxResults=1000',
	port: 443,
	headers: {
		'Authorization': 'Basic ' + new Buffer(config.jira_user + ':' + config.jira_pass).toString('base64'),
		"Content-Type": "application/json"
	}
};

request = https.get(jira_options, function(res){
	var body = "";
	res.on('data', function(data) {
		body += data;
	});

	res.on('end', function() {
		var data = JSON.parse(body);
		var issues = data.issues;

		issues.forEach(function(issue){
			var task_name = issue.key + " - " + issue.fields.summary;
			console.log("Creating Toggl issue: " + task_name);


			var post_data = {
				'task': {
					'pid': config.toggl_project_id,
					'name': task_name
				}
			};

			toggl_options['Content-Length'] = JSON.stringify(post_data).length;

			var toggl_req = https.request(toggl_options, function(res){
				res.setEncoding('utf8');

				var body = "";
				res.on('data', function(data) {
					body += data;
				});
				res.on('end', function() {
					//here we have the full response, html or json object
					try {
						var toggl_response = JSON.parse(body);
						console.log('Created ' + issue.key + ': ' + toggl_response.data.id);


						//update in Jira


					} catch (e) {
						console.log('Error ' + issue.key + ': ' + body);
					}
				});
				res.on('error', function(e) {
					console.log("Got error: " + e.message);
				});
			});

			toggl_req.write(JSON.stringify(post_data));
			toggl_req.end();
		});

	});
	res.on('error', function(e) {
		console.log("Got error: " + e.message);
	});
});