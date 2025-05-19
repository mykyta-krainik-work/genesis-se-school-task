export const SubscribePage = () => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Subscribe to Weather Updates</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          {`
            body {
              font-family: 'Inter', sans-serif;
            }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          `}
        </style>
      </head>
      <body className="bg-gray-100 flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 md:p-12 rounded-lg shadow-xl w-full max-w-lg">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Subscribe for Weather Updates</h1>
          <p className="text-gray-600 mb-8 text-center">
            Get the latest weather forecast delivered to your inbox. Choose your city and how often you want to receive updates.
          </p>
          <form
            id="subscribeForm"
            className="space-y-6"
            action="/api/subscribe"
            method="post"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input type="email" name="email" id="email" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" name="city" id="city" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., London, New York" />
            </div>
            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select id="frequency" name="frequency" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out">
                Subscribe
              </button>
            </div>
          </form>
          <div id="message" className="mt-6 text-center"></div>
        </div>
      </body>
    </html>
  )
} 