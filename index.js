const { loadConfig, delay, innerLog, writeLog, milisecondToRemainTime, timestampToUTC } = require('../modules/core')
const path = require('path')
const colors = require('colors')
const { parse } = require('querystring')



const headers = {
  'Content-Type': 'application/json',
  'Fingerprint': '26dc05c1629a9a1c3a1d7f260c84fce7',
  'Origin': 'https://tgapp.hexn.cc',
  'Platform': 'WEB',
  'Platform-Version': '0.0.38',
  'Priority': 'u=1, i',
  'Sec-Ch-Ua': `"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126", "Microsoft Edge WebView2";v="126"`,
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': "Windows",
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Trace-Uuid': '11de634d-5435-4f38-9c76-660c69f6988f',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'

}

const v = "05f37fd6001c1e3f836c87b5cd66b3863174484b";
const doquest = new Map();
const time = new Map();
const token = new Map();

async function checkVersion() {
  const domain = "https://tgapp.hexn.cc/api/version";
  try {
    const f = await fetch(domain);
    const t = await f.json();
    writeLog({ project: 'hexn', username: '', domain, data: t })
    if (t.error) {
      console.log(colors.red(t.error))
      return;
    }
    console.log(colors.green('Version: ' + t.data))
  } catch (e) {
    writeLog({ project: 'hexn', username: '', domain, data: e })
    console.log(colors.red('Cant check app version'))
  }
}

async function startQuest(init_data, quest_id, user) {
  const domain = "https://clicker.hexn.cc/v1/executed-quest/start"
  const f = await fetch(domain, { method: 'POST', headers, body: JSON.stringify({ init_data, quest_id: +quest_id }) });
  const t = await f.json();

  if (t.status === 'OK') {
    console.log(colors.yellow(user + ' ' + quest_id + 'starting...'));
    await claimQuest(init_data, quest_id, user)
    return;
  }
  console.log(colors.red(user + ' ' + quest_id + 'starting failed'));

}


function showRemainTime() {
  const r = [];

  const array = Array.from(time, ([name, value]) => ({ name, value })).sort(
    (a, b) => a.value - b.value
  );

  for (const i of array) {
    const username = i.name;
    r.push({ username, remain: timestampToUTC(i.value) });
  }
  console.table(r);
}

async function claimToken(init_data, user) {
  const domain = "https://clicker.hexn.cc/v1/farming/claim"
  const f = await fetch(domain, { method: 'POST', headers, body: JSON.stringify({ init_data }) });
  const t = await f.json();
  if (t.data?.balance) {
    console.log(colors.green(user + ' claim done ' + t.data.balance));
    return;
  }

  const domain1 = "https://clicker.hexn.cc/v1/farming/start"
  const f1 = await fetch(domain1, { method: 'POST', headers, body: JSON.stringify({ init_data, }) });
  const t1 = await f1.json();

  if (t1.data?.points_amount) {
    console.log(colors.green(user + ' start farm OK'));
    return;
  }

  console.log(colors.red(user + ' claim failed'));
}

async function claimQuest(init_data, quest_id, user) {
  const domain = "https://clicker.hexn.cc/v1/executed-quest/claim"
  const f = await fetch(domain, { method: 'POST', headers, body: JSON.stringify({ init_data, quest_id: +quest_id }) });
  const t = await f.json();
  if (t.data?.balance) {
    console.log(colors.green(user + ' ' + quest_id + ' done' + ' balance: ' + t.data.balance));
    return;
  }

  console.log(colors.red(user + ' ' + quest_id + 'claim failed'));
}

async function getState(query) {
  const n = JSON.parse(parse(query).user)
  const username = n.first_name || n.username
  token.set(username, query)
  const domain = "https://clicker.hexn.cc/v1/state";
  try {
    const f = await fetch(domain, { method: 'POST', headers, body: JSON.stringify({ init_data: query }) });
    const t = await f.json();
    writeLog({ project: 'hexn', username, domain, data: t })
    if (t.status !== 'OK') {
      console.log(colors.red(t.error))
      return;
    }



    if (t.data?.farming) {
      console.log(colors.green(username + ' '), colors.yellow(t.data.balance))
      time.set(username, t.data.farming.end_at)
    } else {
      await claimToken(query, username);
      await delay(1, false)
      await getState(query)
    }


    if (t.data?.config?.quests && !doquest.has(username) && t.data?.executed_quests) {
      const listQ = t.data.config.quests
      doquest.set(username, true);
      const questUnDone = Object.keys(listQ).filter(i => !t.data.executed_quests[i])
      for await (const id of questUnDone) {
        await delay(0.5, true)
        await startQuest(query, id, username)
      }
    }

  } catch (e) {
    console.log(colors.red(username + e))
    writeLog({ project: 'hexn', username, domain, data: e })
  }
}

async function getNearestTime() {
  return new Promise((ok) => {
    const keyValue = Array.from(time, ([k, v]) => ({ k, v }));
    if (!keyValue.length) ok([]);
    const nearest = Math.min(...Object.values(keyValue.map((i) => i.v)));
    const zz = keyValue.find((i) => i.v === nearest);
    if (!zz) ok([]);
    const username = zz.k
    const remainTime = nearest - Date.now();
    console.log("");
    innerLog(
      "next claim",
      `${username} ${remainTime <= 0 ? "NOW" : milisecondToRemainTime(remainTime)
      }`,
      remainTime > 0 ? timestampToUTC(nearest) : ""
    );
    console.log("");
    ok([username, Math.round(remainTime) / 1000]);
  });
}

async function handler(tokens) {
  for await (const token of tokens) {
    await getState(token);
  }

  showRemainTime();

  const nearest = await getNearestTime();
  if (!nearest.length) {
    await delay(5, true);
    return handler(tokens);
  }

  const [username, time] = nearest;

  await delay((time) + 5);
  await claimToken(token.get(username), username)
  await delay(1, true)
  handler(tokens)
}

(async function main() {
  const tokens = await loadConfig(path.resolve(__dirname, 'data.txt'))
  // await checkVersion();

  await handler(tokens)
})()