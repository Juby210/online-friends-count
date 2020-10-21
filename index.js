const { Plugin } = require('powercord/entities');
const { React, Flux, getModule, getModuleByDisplayName, contextMenu } = require('powercord/webpack');
const { forceUpdateElement, getOwnerInstance, waitFor } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { Clickable } = require('powercord/components');
const { constants, constants: { Stores } } = require('./core');

class OnlineFriends extends Plugin {
  constructor () {
    super();

    this.state = {
      type: 0
    };
  }

  async startPlugin () {
    this.loadCSS(require('path').resolve(__dirname, 'style.css'));
    this.utils = require('./core/utils')(this);
    this.classes = {
      ...await getModule([ 'guildSeparator', 'listItem' ])
    };

    await this._importStores();
    this._patchHomeComponent();
  }

  pluginWillUnload () {
    uninject('onlineFriends-FriendCount');

    if (this.homeBtn) this.homeBtn.forceUpdate();
  }

  async _patchHomeComponent () {
    const FriendsOnline = Flux.connectStores(
      [ constants.StatusStore ],
      () => ({ friendCount: constants.StatusStore.getOnlineFriendCount() })
    )(this._renderFriendsCount.bind(this));
    const _this = this;

    const { DefaultHomeButton } = await getModule([ 'DefaultHomeButton' ]);
    inject('onlineFriends-FriendCount', DefaultHomeButton.prototype, 'render', function (_, res) {
      if (!Array.isArray(res)) {
        res = [ res ];
        res.props = res[0].props;
      }

      const types = {
        1: 'FRIEND',
        2: 'PENDING_INCOMING',
        3: 'BLOCKED'
      };

      const ExtendedCount = Flux.connectStores(
        [ _this.state.type !== 4 ? constants.RelationshipStore : constants.GuildStore ], () => ({
          extendedCount: types[_this.state.type] ? _this.utils.relationshipCounts[types[_this.state.type]] : _this.utils.guildCount
        })
      )(_this._renderExtendedCount.bind(_this));
      _this.homeBtn = this;

      res.push(
        React.createElement('div', {
          className: _this.classes.listItem
        }, _this.state.type > 0
          ? React.createElement(ExtendedCount)
          : React.createElement(FriendsOnline),
        React.createElement('div', {
          style: { marginTop: '10px' }
        }))
      );
      return res;
    });
  }

  _onClickHandler () {
    this.utils.skipFilteredCounters();
    this.state.type = this.state.type % Object.keys(constants.Types).length;

    const counter = document.querySelector('.onlineFriends-friendsOnline');
    if (counter) {
      counter.style.animation = 'none';

      setTimeout(() => {
        counter.style.animation = null;
      }, 100);
    }

    if (this.homeBtn) this.homeBtn.forceUpdate();
  }

  _onContextMenuHandler (e) {
    const CountersContextMenu = require('./components/ContextMenu');

    contextMenu.openContextMenu(e, () =>
      React.createElement(CountersContextMenu, {
        counterTypes: constants.Types,
        main: this
      })
    );
  }

  _createCounter (value) {
    return React.createElement(Clickable, {
      className: 'onlineFriends-friendsOnline',
      onClick: this._onClickHandler.bind(this),
      onContextMenu: this._onContextMenuHandler.bind(this),
      style: {
        cursor: 'pointer'
      }
    }, value);
  }

  _renderExtendedCount ({ extendedCount }) {
    const types = constants.Types;
    const type = Object.keys(types)[Object.values(types).indexOf(this.state.type)];

    return this._createCounter(`${extendedCount <= 9999 ? extendedCount : '9999+'} ${type}`);
  }

  _renderFriendsCount ({ friendCount }) {
    return this._createCounter(`${friendCount <= 9999 ? friendCount : '9999+'} Online`);
  }

  async _importStores () {
    for (const store in Stores) {
      await this.utils.import(store, Stores[store]);
    }
  }
}

module.exports = OnlineFriends;
