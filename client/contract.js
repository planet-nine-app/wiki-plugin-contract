let fountUser;
let allyabaseUser;

async function post(url, payload) {
  return await fetch(url, {
    method: 'post',
    body: JSON.stringify(payload),
    headers: {'Content-Type': 'application/json'}
  });
};

function getPage($item) {
  return $item.parents('.page').data('data');
};

function getAllyabaseUser(item) {
  if(item.allyabaseUser) {
    return item.allyabaseUser;
  } else {
    return fetch('/plugin/contract/user').then(res => res.json());
  }
};

function getBDOs($item, page) {
  let bdoPromises = [];
  if(page.transferees) {
    page.transferees.forEach(transferee => {
      if(!transferee.bdoPubKey) {
        return;
      }
      const transfereeDiv = document.createElement('div');
      transfereeDiv.innerHTML = '<p>Fetching transfer details for ${transferee.bdoUUID}</p>';
      $item.append(transfereeDiv);
      const bdoPromise = fetch(`/plugin/contract/bdo?pubKey=${transferee.bdoPubKey}`)
        .then(bdo => {
          if(bdo.bdoUUID) {
            transfereeDiv.innerHTML = `<p>Transferee: ${bdo.bdoUUID} at ${bdo.host}</p>
              <button id="${transferee.bdoPubKey}">Advance</button>`;
          } else {
            transfereeDiv.innerHTML = '<p>No BDO uuid found for this transferee</p>';
          }
        });
      bdoPromises.push(bdoPromise);
    });

    return Promise.all(bdoPromises);
  } else {
    return $item.append(`<div><p>You have no transferees yet. Get on that marketing!</p></div>`);
  }
};

function getSignedFount(allyabaseUser, $item, item) { 
  if(item.signature) {
    const storyText = getPage($item).story.map($ => $.text).join('');
    const message = item.timestamp + item.host + allyabaseUser.fountUser.uuid + allyabaseUser.bdoUser.uuid + storyText;
    return fetch(`/plugin/contract/verify?signature=${item.signature}&message=${message}`)
      .then(verified => {
        if(verified) {
          $item.append(`<div><p>This content is signed and verified!</p></div>`);
        } else {
          $item.append(`<div><p>This content is not signed yet. Hit the Sign button to sign it.</p></div>`);
        }
      })
      .catch(err => console.warn('got an error with signature'));
  }
};

function getTransferees($item, item, allyabaseUser) {
console.log('what is allyabaseUser here with transferees', allyabaseUser);
  if(!allyabaseUser) {
    $item.append(`<div><p>No Allyabase User with transferees</p></div>`);
    return;
  }
console.log('about to do transferPromises');
  let transfereesPromises = [];
  const transferees = allyabaseUser.bdoUser && allyabaseUser.bdoUser.bdo && allyabaseUser.bdoUser.bdo.transferees;
  Object.keys(transferees).forEach(uuid => {
console.log('transferees', transferees);
console.log('uuid', uuid);
console.log('transferees[uuid]', transferees[uuid]);
    const path = decodeURIComponent(transferees[uuid]);
console.log('getting user from ', path);
    const prom = fetch(path)
      .then(resp => resp.json())
      .then(transferee => {
console.log('transferee looks like: ', transferee);
        let sodoto = '';
        if(!transferee.fountUser) {
          transferee.fountUser = {};
        }
        switch(transferee.fountUser.nineumCount) {
          case 0: sodoto = 'signed up';
            break;
          case 1: sodoto = 'seen one';
            break;
          case 2: sodoto = 'seen one and done one';
            break;
          case 3: sodoto = 'seen one and done one and taught one (sodoto)';
            break;
          default: sodoto = 'seen one and done one and taught one (sodoto)';
            break;
        } 
        $item.append(`<div><p>The transferee at ${transferees[uuid]} has ${sodoto}.</p></div>`);
        $item.append(`<div><p>Grant the next level token to transferee at ${transferees[uuid]}?   <button id=${uuid}>Advance</button></p></div>`);
      });
    transfereesPromises.push(prom);
  });
  return Promise.all(transfereesPromises);
};

function addForkPrompt($item, item) {
  $item.append(`<div><p>Fork this to start or continue the contracting process.</p></div>`);
};

function addSignaturePrompt($item, item) {
  const page = getPage($item);
console.log(page);

  $item.append(`<div><p>Sign this to accept this contract.    <button id="signButton">Sign</button></p></div>`);
};

function addCompletionPrompt($item, item) {
  const page = getPage($item);
console.log(page);
  $item.append(`<div><p>Accept this contract.    <button id="acceptButton">Accept</button></p></div>`);
};

function emit($item, item) {
  $item.empty(item);

  const gettingUserDiv = document.createElement('div');
  gettingUserDiv.innerHTML = '<p>Getting your allyabase user, and signatures...</p>';
  $item.append(gettingUserDiv);
  let user;

  getAllyabaseUser(item)
    .then(_allyabaseUser => {
console.log('item is now', item);
      allyabaseUser = _allyabaseUser;
      const signatures = item.signatures;
      const siteNum = signatures ? Object.keys(signatures).length : 0;
      const forkNum = getPage($item).journal.filter($ => $.type === 'fork').length;

      if(item.accepted) {
        $item.append(`<div><p>This contract has been completed.</p></div>`);
      } else if(siteNum > 1 && siteNum === forkNum && item.signatures && item.signatures[window.location.host]) {
        addCompletionPrompt($item, item);
      } else if(siteNum < forkNum) {
        addSignaturePrompt($item, item);
//      } else (siteNum < 1 || siteNum === forkNum) {
      } else {
        addForkPrompt($item, item);
      }
    })
    .catch(err => console.warn('received an error emitting in contract plugin', err))
    .finally(() => {
console.log('finally');
      bind($item, item);
    });
};

function bind($item, item) {
console.log('bind called');

  $item.find('#signButton').click(function() {
console.log('sign here');
    const host = window.location.host;
    const page = getPage($item);

    const contracts = page.story.filter($ => $.type === 'contract');
    const contract = contracts.length > 0 ? contracts.pop() : null;
    if(!contract) {
      return $item.append(`<div><p>There's no contract here.</p></div>`);
    }

    if(!allyabaseUser || !allyabaseUser.fountUser) {
      return $item.append(`<div><p>You need to connect to a base.</p></div>`);
    }

    const timestamp = new Date().getTime() + '';
    const message = timestamp + host + contract.id + contract.text + allyabaseUser.fountUser.uuid;

    fetch('/plugin/contract/sign/' + message)
      .then(resp => resp.json())
      .then(json => { 
console.log('got json', json);
	const signature = json.signature;
console.log('before if');
	if(!item.signatures) {
	  item.signatures = {};
	}

console.log('before second if');
	if(!item.signatures[host]) {
	  item.signatures[host] = {};
	}

console.log('before host and timestamp', contract);
	item.signatures[host][timestamp] = {
	  contractId: contract.id,
	  contractText: contract.text,
          uuid: allyabaseUser.fountUser.uuid,
	  signature: signature
	};
console.log('should add to handler');

        wiki.pageHandler.put($item.parents('.page:first'), {
          type: 'edit',
          id: item.id,
          item: item
        });

        emit($item, item);
        bind($item, item);
      })
      .catch(err => console.warn);
  });

  $item.find('#acceptButton').click(function() {
console.log('accept here');
    if(!allyabaseUser || !allyabaseUser.fountUser) {
      return $item.append(`<div><p>You need to connect to a base.</p></div>`);
    }
    const toSignatureHost = item.signatures ? Object.keys(item.signatures).filter($ => window.location.host !== $).pop() : null;

    if(!toSignatureHost) {
      return;
    }

    const signatures = item.signatures[toSignatureHost];
    const toSignatureTimestamp = signatures ? Object.keys(signatures).pop() : null;

    if(!toSignatureTimestamp) {
      return;
    }

    const toSignature = signatures[toSignatureTimestamp];
console.log('toSignature', toSignature, item);
    const toUUID = toSignature.uuid;
    const flavor = '24071209a3b3';

    if(!toUUID) {
      return $item.append(`<div><p>Not enough signatures.</p></div>`);
    }
console.log('about to post', {toUUID, flavor});

    fetch('/plugin/contract/grant-nineum', {
        method: 'post',
        body: JSON.stringify({toUUID, flavor}),
        headers: {'Content-Type': 'application/json'}
      })
      .then(resp => resp.json())
      .then(grantee => {
console.log('got a grantee', grantee);
        allyabaseUser.fountUser = grantee;
        item.accepted = true;
        wiki.pageHandler.put($item.parents('.page:first'), {
          type: 'edit',
          id: item.id,
          item: item
        });

        emit($item, item);
        bind($item, item);
      });
  });

console.log('listeners added');
};

if(window) {
  window.plugins['contract'] = {emit, bind};
}

export const contract = typeof window == 'undefined' ? { emit, bind } : undefined;
