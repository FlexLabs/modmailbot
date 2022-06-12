/**
 * These component objects are used during the process of reporting a user, and
 * requesting help with premium/payments!
 */

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
      custom_id: "sendUserID"
    },
    {
      type: 2,
      style: 1,
      label: "Send Thread ID",
      emoji: {
        name: "DaveRingRight",
        id: "815830334163255326"
      },
      custom_id: "sendThreadID"
    },
    {
      type: 2,
      style: 1,
      label: "Move to Council",
      emoji: {
        name: "DaveBanana",
        id: "752731353266520084"
      },
      custom_id: "redirectAdmins"
    },
    {
      type: 2,
      style: 1,
      label: "Redirect to Support Channel",
      emoji: {
        name: "DaveDerp",
        id: "687013677681213484"
      },
      custom_id: "redirectSupport"
    },
    {
      type: 2,
      style: 4,
      label: "Block User",
      emoji: {
        name: "DaveCult",
        id: "827253899403722803"
      },
      custom_id: "blockUser"
    }
  ]
}];

const moveToAdmins = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 1,
      label: "Move Thread & Ping",
      custom_id: "redirectAdminsConfirm-ping"
    },
    {
      type: 2,
      style: 1,
      label: "Move Thread",
      custom_id: "redirectAdminsConfirm"
    },
    {
      type: 2,
      style: 4,
      label: "Cancel",
      custom_id: "redirectAdminsCancel"
    }
  ]
}];

const blockUserModal = {
  title: "Block User!",
  custom_id: "confirmBlockUser",
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
  custom_id: "reportUser",
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
        placeholder: "Add any additional information here, and any message/screenshot links we can use for reference."
      }]
    }
  ]
};

const moderationHelpReasons = [{
  type: 1,
  components: [
    {
      type: 3,
      custom_id: "moderationHelpReasons",
      options: [
        {
          "label": "Report a User",
          "value": "reportUser"
        },
        {
          "label": "Report Dyno Impersonation",
          "value": "dynoImp"
        },
        {
          "label": "Appeal a Ban",
          "value": "banAppeal"
        },
        {
          "label": "Appeal a Mute",
          "value": "muteAppeal"
        },
        {
          "label": "Other",
          "value": "idfk",
          "desription": "Your issue isn't listed here? Open a thread and explain further."
        }
      ],
      min_values: 1,
      max_values: 1,
      placeholder: "What do you need help with?"
    }
  ]
}];

/*const reportUserSelectReason = [{
  type: 1,
  components: [
    {
      type: 3,
      custom_id: "reportUserReason",
      options: [
        {
          "label": "Inappropriate behavior in DMs",
          "value": "badDMs",
          "description": "DM ads, phishing, harassment, NSFW/NSFL, or spam."
        },
        {
          "label": "Breaking Dyno™ server rule",
          "value": "ruleBreaker",
          "description": "Alert staff of a user currently violating rules inside #welcome."
        },
        {
          "label": "Dyno impersonation",
          "value": "impersonation",
          "description": "Report a user, or bot, for using Dynos avatar or username."
        },
        {
          "label": "Report a staff member",
          "value": "reportStaff",
          "description": "Make a complaint about one of our staff members."
        },
        {
          "label": "Other",
          "value": "noFuckingClue",
          "description": "Report something not listed here."
        }
      ],
      min_values: 1,
      max_values: 1,
      placeholder: "What do you need to report?"
    }
  ]
}];*/

module.exports = {
  internalButtons,
  moveToAdmins,
  blockUserModal,
  reportUserModal,
  moderationHelpReasons
};
