const axios = require('axios');
(async () => {
  try {
    const res = await axios.get("https://api.openrouteservice.org/v2/directions/driving-car", {
      params: { start: "8.681495,49.41461", end: "8.687872,49.420318" },
      headers: { Authorization: "fakekey" }
    });
    console.log(res.status);
  } catch (e) {
    console.error(e.response ? e.response.status : e.message);
  }
})();
