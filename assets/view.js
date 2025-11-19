CTFd._internal.challenge.data = undefined;
CTFd._internal.challenge.renderer = null;
CTFd._internal.challenge.preRender = function () {};
CTFd._internal.challenge.render = null;
CTFd._internal.challenge.postRender = function () {
    // Initialize CTFd's hint functionality
    // This ensures hints work properly even with custom challenge rendering
    if (typeof CTFd !== 'undefined' && CTFd.ui && CTFd.ui.ezq) {
        CTFd.lib.$(".challenge-hints button").off("click").on("click", function(event) {
            event.preventDefault();
            const hintId = CTFd.lib.$(this).attr("hint-id");

            // First, fetch the hint to check if it's already unlocked
            CTFd.fetch("/api/v1/hints/" + hintId, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function(response) {
                return response.json();
            }).then(function(response) {
                if (response.success) {
                    const hint = response.data;

                    // Check if hint has content (already unlocked)
                    if (hint.content) {
                        // Hint is unlocked, show it directly
                        CTFd.ui.ezq.ezAlert({
                            title: hint.title || "Hint",
                            body: hint.content,
                            button: "Got it!"
                        });
                    } else {
                        // Hint is locked, show unlock modal
                        const cost = hint.cost || 0;
                        CTFd.ui.ezq.ezQuery({
                            title: "Unlock Hint?",
                            body: "Are you sure you want to unlock this hint for " + cost + " points?",
                            success: function() {
                                const loadingModal = CTFd.ui.ezq.ezProgressModal();
                                loadingModal.modal("show");

                                // POST to unlock the hint
                                CTFd.fetch("/api/v1/hints/" + hintId, {
                                    method: "POST",
                                    credentials: "same-origin",
                                    headers: {
                                        "Accept": "application/json",
                                        "Content-Type": "application/json"
                                    }
                                }).then(function(response) {
                                    return response.json();
                                }).then(function(response) {
                                    loadingModal.modal("hide");
                                    if (response.success) {
                                        const unlockedHint = response.data;
                                        CTFd.ui.ezq.ezAlert({
                                            title: unlockedHint.title || "Hint",
                                            body: unlockedHint.content,
                                            button: "Got it!"
                                        });

                                        // Update the hint button to show it's unlocked
                                        CTFd.lib.$("button[hint-id='" + hintId + "']").addClass("btn-success").removeClass("btn-info");
                                    } else {
                                        CTFd.ui.ezq.ezAlert({
                                            title: "Error",
                                            body: response.errors ? response.errors.join("<br>") : "Failed to unlock hint",
                                            button: "OK"
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        });
    }
};

CTFd._internal.challenge.submit = function (preview) {
    var challenge_id = parseInt(CTFd.lib.$("#challenge-id").val());
    var submission = CTFd.lib.$("#challenge-input").val();

    let alert = resetAlert();

    var body = {
        challenge_id: challenge_id,
        submission: submission,
    };
    var params = {};
    if (preview) {
        params["preview"] = true;
    }

    return CTFd.api
        .post_challenge_attempt(params, body)
        .then(function (response) {
            if (response.status === 429) return response; // Rate limit
            if (response.status === 403) return response; // Not logged in / CTF paused
            return response;
        });
};

function mergeQueryParams(parameters, queryParameters) {
    if (parameters.$queryParameters) {
        Object.keys(parameters.$queryParameters).forEach(function (parameterName) {
            queryParameters[parameterName] = parameters.$queryParameters[parameterName];
        });
    }
    return queryParameters;
}

function resetAlert() {
    let alert = document.getElementById("deployment-info");
    alert.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    alert.classList.remove("alert-danger");

    // Disable buttons while loading
    document.getElementById("create-chal").disabled = true;
    document.getElementById("extend-chal").disabled = true;
    document.getElementById("terminate-chal").disabled = true;

    return alert;
}

function enableButtons() {
    document.getElementById("create-chal").disabled = false;
    document.getElementById("extend-chal").disabled = false;
    document.getElementById("terminate-chal").disabled = false;
}

function toggleChallengeCreate() {
    document.getElementById("create-chal").classList.toggle('d-none');
}

function toggleChallengeUpdate() {
    document.getElementById("extend-chal").classList.toggle('d-none');
    document.getElementById("terminate-chal").classList.toggle('d-none');
}

function calculateExpiry(date) {
    return Math.ceil((new Date(date * 1000) - new Date()) / 1000 / 60);
}

function createChallengeLinkElement(data, parent) {
    parent.innerHTML = "";

    let expires = document.createElement('span');
    expires.textContent = "Expires in " + calculateExpiry(new Date(data.expires)) + " minutes.";
    parent.append(expires, document.createElement('br'));

    if (data.connect == "tcp") {
        let codeElement = document.createElement('code');
        codeElement.textContent = 'nc ' + data.hostname + " " + data.port;
        parent.append(codeElement);
    } else if (data.connect == "ssh") {
        let codeElement = document.createElement('code');
        // Support both password-based and key-based SSH authentication
        if (data.ssh_password == null) {
            codeElement.textContent = 'ssh -o StrictHostKeyChecking=no ' + data.ssh_username + '@' + data.hostname + " -p" + data.port;
        } else {
            codeElement.textContent = 'sshpass -p' + data.ssh_password + " ssh -o StrictHostKeyChecking=no " + data.ssh_username + '@' + data.hostname + " -p" + data.port;
        }
        parent.append(codeElement);
    } else {
        let link = document.createElement('a');
        link.href = 'http://' + data.hostname + ":" + data.port;
        link.textContent = 'http://' + data.hostname + ":" + data.port;
        link.target = '_blank';
        parent.append(link);
    }
}

function view_container_info(challenge_id) {
    let alert = resetAlert();

    fetch("/containers/api/view_info", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "CSRF-Token": init.csrfNonce
        },
        body: JSON.stringify({ chal_id: challenge_id })
    })
    .then(response => response.json())
    .then(data => {
        alert.innerHTML = ""; // Remove spinner
        if (data.status == "Challenge not started") {
            alert.innerHTML = data.status;
            toggleChallengeCreate();
        } else if (data.status == "already_running") {
            createChallengeLinkElement(data, alert);
            toggleChallengeUpdate();
        } else {
            alert.innerHTML = data.message;
            alert.classList.add("alert-danger");
            toggleChallengeUpdate();
        }
    })
    .catch(error => {
        alert.innerHTML = "Error fetching container info.";
        alert.classList.add("alert-danger");
        console.error("Fetch error:", error);
    })
    .finally(enableButtons);
}

function container_request(challenge_id) {
    let alert = resetAlert();

    fetch("/containers/api/request", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "CSRF-Token": init.csrfNonce
        },
        body: JSON.stringify({ chal_id: challenge_id })
    })
    .then(response => response.json())
    .then(data => {
        alert.innerHTML = ""; // Remove spinner
        if (data.error) {
            alert.innerHTML = data.error;
            alert.classList.add("alert-danger");
            toggleChallengeCreate();
        } else if (data.message) {
            alert.innerHTML = data.message;
            alert.classList.add("alert-danger");
            toggleChallengeCreate();
        } else {
            createChallengeLinkElement(data, alert);
            toggleChallengeUpdate();
            toggleChallengeCreate();
        }
    })
    .catch(error => {
        alert.innerHTML = "Error requesting container.";
        alert.classList.add("alert-danger");
        console.error("Fetch error:", error);
    })
    .finally(enableButtons);
}

function container_renew(challenge_id) {
    let alert = resetAlert();

    fetch("/containers/api/renew", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "CSRF-Token": init.csrfNonce
        },
        body: JSON.stringify({ chal_id: challenge_id })
    })
    .then(response => response.json())
    .then(data => {
        alert.innerHTML = ""; // Remove spinner
        if (data.error) {
            alert.innerHTML = data.error;
            alert.classList.add("alert-danger");
        } else if (data.message) {
            alert.innerHTML = data.message;
            alert.classList.add("alert-danger");
        } else {
            createChallengeLinkElement(data, alert);
        }
    })
    .catch(error => {
        alert.innerHTML = "Error renewing container.";
        alert.classList.add("alert-danger");
        console.error("Fetch error:", error);
    })
    .finally(enableButtons);
}

function container_stop(challenge_id) {
    let alert = resetAlert();

    fetch("/containers/api/stop", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "CSRF-Token": init.csrfNonce
        },
        body: JSON.stringify({ chal_id: challenge_id })
    })
    .then(response => response.json())
    .then(data => {
        alert.innerHTML = ""; // Remove spinner
        if (data.error) {
            alert.innerHTML = data.error;
            alert.classList.add("alert-danger");
            toggleChallengeCreate();
        } else if (data.message) {
            alert.innerHTML = data.message;
            alert.classList.add("alert-danger");
            toggleChallengeCreate();
        } else {
            alert.innerHTML = "Challenge Terminated.";
            toggleChallengeCreate();
            toggleChallengeUpdate();
        }
    })
    .catch(error => {
        alert.innerHTML = "Error stopping container.";
        alert.classList.add("alert-danger");
        console.error("Fetch error:", error);
    })
    .finally(enableButtons);
}