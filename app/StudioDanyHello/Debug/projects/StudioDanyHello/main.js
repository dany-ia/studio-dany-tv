window.onload = function () {
    function tick() {
        var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
        document.getElementById("clock").textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    tick(); setInterval(tick, 1000);
    // Back / Return on the remote exits the app so the stock Home is always reachable.
    document.addEventListener("keydown", function (e) {
        if (e.keyCode === 10009) { try { tizen.application.getCurrentApplication().exit(); } catch (err) {} }
    });
};
