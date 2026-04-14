import { createClient } from 'redis';

const client = createClient();
await client.connect();

// Saving player data using a Hash
await client.hSet('player:101', {
    username: 'Skyler',
    score: '500',
});