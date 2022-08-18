/**
 * These component objects are used during the process of reporting a user, and
 * requesting help with premium/payments!
 */
 const internalClose = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 4,
      label: "Close Thread",
      emoji: {
        name: "DaveHangUp",
        id: "815830349816659968"
      },
      custom_id: "thread:close"
    },
    {
      type: 2,
      style: 4,
      label: "Close Thread in 10m",
      emoji: {
        name: "DaveHangUp",
        id: "815830349816659968"
      },
      custom_id: "thread:closeIn10"
    }
  ]
}];

const internalButtons = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 1,
      label: "Send User ID",
      emoji: {
        name: "DaveRing",
        id: "815827221549154355"
      },
      custom_id: "thread:sendUserID"
    },
    {
      type: 2,
      style: 1,
      label: "Send Thread ID",
      emoji: {
        name: "DaveRingRight",
        id: "815830334163255326"
      },
      custom_id: "thread:sendThreadID"
    },
    {
      type: 2,
      style: 1,
      label: "Move to Council",
      emoji: {
        name: "DaveBanana",
        id: "752731353266520084"
      },
      custom_id: "thread:redirectAdmins"
    },
    {
      type: 2,
      style: 1,
      label: "Redirect to Support Channel",
      emoji: {
        name: "DaveDerp",
        id: "687013677681213484"
      },
      custom_id: "thread:redirectSupport"
    },
    {
      type: 2,
      style: 4,
      label: "Block User",
      emoji: {
        name: "DaveCult",
        id: "827253899403722803"
      },
      custom_id: "thread:blockUser"
    }
  ]
}];

const moveToAdmins = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 1,
      label: "Move Council & Ping",
      custom_id: "movethread:council-ping"
    },
    {
      type: 2,
      style: 1,
      label: "Move Council",
      custom_id: "movethread:council"
    },
    {
      type: 2,
      style: 4,
      label: "Cancel",
      custom_id: "movethread:cancel"
    }
  ]
}];

const blockUserModal = {
  title: "Block User!",
  custom_id: "blockuser:block",
  components: [{
    type: 1,
    components: [
      {
        type: 4,
        custom_id: "reason",
        style: 2,
        label: "Reason",
        min_length: 1,
        max_length: 1000,
        placeholder: "Please enter a reason!"
      }
    ]
  }]
};

const reportUserModal = {
  title: "Report User!",
  custom_id: "threadopen:userReport",
  components: [
    {
      type: 1,
      components: [{
        type: 4,
        custom_id: "userID",
        style: 1,
        label: "User ID/Name",
        min_length: 1,
        max_length: 32,
        placeholder: "Please enter a user ID!"
      }]
    },
    {
      type: 1,
      components: [{
        type: 4,
        custom_id: "reason",
        style: 2,
        label: "Reason",
        min_length: 1,
        max_length: 1000,
        placeholder: "Please enter a reason!"
      }]
    },
    {
      type: 1,
      components: [{
        type: 4,
        custom_id: "context",
        style: 2,
        label: "Additional Context/Links (Optional)",
        max_length: 1000,
        required: false,
        placeholder: "Add any additional information here, and any message links we can use for reference."
      }]
    }
  ]
};

const moderationHelpReasons = [{
  type: 1,
  components: [
    {
      type: 3,
      custom_id: "threadopenmoderation:moderationHelpReasons",
      options: [
        {
          "label": "Report a User",
          "value": "threadopenmoderation:reportUser"
        },
        {
          "label": "Report Dyno Impersonation",
          "value": "threadopenmoderation:dynoImp"
        },
        {
          "label": "Appeal a Ban",
          "value": "threadopenmoderation:banAppeal"
        },
        {
          "label": "Appeal a Mute",
          "value": "threadopenmoderation:muteAppeal"
        },
        {
          "label": "Other",
          "value": "threadopenmoderation:idfk",
          "desription": "Your issue isn't listed here? Open a thread and explain further."
        },
        {
          "label": "Cancel",
          "value": "threadopenmoderation:cancel",
          "description": "Cancel opening a modmail thread"
        }
      ],
      min_values: 1,
      max_values: 1,
      placeholder: "What do you need help with?"
    }
  ]
}];

module.exports = {
  internalClose,
  internalButtons,
  moveToAdmins,
  blockUserModal,
  reportUserModal,
  moderationHelpReasons
};
