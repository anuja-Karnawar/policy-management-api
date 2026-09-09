
/* Handles policy search and policy aggregation.
* Both queries use MongoDB aggregation so the related collections
* can be fetched in a single database operation.*/

const Policy = require('../models/Policy');
const { AppError, asyncHandler } = require('../config/error.config');


// Escape special characters before using user input in a regex.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/*
 * GET /api/policies/search?username=madler@yahoo.ca
 * Search by email or first name.
 */
exports.searchPolicyByUsername = asyncHandler(async (req, res) => {

  const { username } = req.query;

  if (!username || !username.trim()) {
    throw new AppError(
      'username query parameter is required',
      400
    );
  }

  const searchValue = username.trim();


  // Start with policies and join the user information.
  const policies = await Policy.aggregate([

    // Get the user linked to the policy.
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },

    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: false
      }
    },


    // Match the requested email or first name.
    {
      $match: {
        $or: [
          {
            'user.email': {
              $regex: `^${escapeRegex(searchValue)}$`,
              $options: 'i'
            }
          },
          {
            'user.firstName': {
              $regex: `^${escapeRegex(searchValue)}$`,
              $options: 'i'
            }
          }
        ]
      }
    },


    // Get agent details.
    {
      $lookup: {
        from: 'agents',
        localField: 'agentId',
        foreignField: '_id',
        as: 'agent'
      }
    },

    {
      $unwind: {
        path: '$agent',
        preserveNullAndEmptyArrays: true
      }
    },


    // Get account details.
    {
      $lookup: {
        from: 'accounts',
        localField: 'accountId',
        foreignField: '_id',
        as: 'account'
      }
    },

    {
      $unwind: {
        path: '$account',
        preserveNullAndEmptyArrays: true
      }
    },


    // Get policy category details.
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },

    {
      $unwind: {
        path: '$category',
        preserveNullAndEmptyArrays: true
      }
    },


    // Get carrier details.
    {
      $lookup: {
        from: 'carriers',
        localField: 'companyId',
        foreignField: '_id',
        as: 'carrier'
      }
    },

    {
      $unwind: {
        path: '$carrier',
        preserveNullAndEmptyArrays: true
      }
    },


    // Return only the fields needed by the API.
    {
      $project: {
        _id: 1,
        policyNumber: 1,
        policyStartDate: 1,
        policyEndDate: 1,
        premiumAmount: 1,

        userId: '$user._id',

        user: {
          firstName: '$user.firstName',
          dob: '$user.dob',
          address: '$user.address',
          phoneNumber: '$user.phoneNumber',
          state: '$user.state',
          zipCode: '$user.zipCode',
          email: '$user.email',
          gender: '$user.gender',
          userType: '$user.userType'
        },

        agent: {
          id: '$agent._id',
          agentName: '$agent.agentName'
        },

        account: {
          id: '$account._id',
          accountName: '$account.accountName'
        },

        category: {
          id: '$category._id',
          categoryName: '$category.categoryName'
        },

        carrier: {
          id: '$carrier._id',
          companyName: '$carrier.companyName'
        }
      }
    },


    // Show the newest policies first.
    {
      $sort: {
        policyStartDate: -1
      }
    }

  ]);


  if (!policies.length) {
    throw new AppError(
      `No policy found for username: ${searchValue}`,
      404
    );
  }


  res.status(200).json({
    success: true,
    count: policies.length,
    username: searchValue,
    data: policies
  });

});


/*
 * GET /api/policies/aggregate
 * Returns policy totals grouped by user.
 */
exports.aggregatePoliciesByUser = asyncHandler(async (req, res) => {

  const result = await Policy.aggregate([

    // Group policies by user.
    {
      $group: {
        _id: '$userId',

        totalPolicies: {
          $sum: 1
        },

        totalPremium: {
          $sum: '$premiumAmount'
        },

        policyNumbers: {
          $push: '$policyNumber'
        },

        categoryIds: {
          $addToSet: '$categoryId'
        }
      }
    },


    // Add user details to the result.
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },

    {
      $unwind: '$user'
    },


    // Get the category names for the user's policies.
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryIds',
        foreignField: '_id',
        as: 'categories'
      }
    },


    // Keep the response fields simple.
    {
      $project: {
        _id: 0,

        userId: '$_id',

        firstName: '$user.firstName',

        email: '$user.email',

        userType: '$user.userType',

        totalPolicies: 1,

        totalPremium: 1,

        policyNumbers: 1,

        categories: '$categories.categoryName'
      }
    },


    // Users with more policies appear first.
    {
      $sort: {
        totalPolicies: -1
      }
    }

  ]);


  res.status(200).json({
    success: true,
    count: result.length,
    data: result
  });

});
