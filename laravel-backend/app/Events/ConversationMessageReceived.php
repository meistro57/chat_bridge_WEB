<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationMessageReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $conversation;
    public $message;

    public function __construct(Conversation $conversation, Message $message)
    {
        $this->conversation = $conversation;
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new Channel('conversation.' . $this->conversation->id);
    }

    public function broadcastWith()
    {
        return [
            'conversation_id' => $this->conversation->id,
            'message' => [
                'content' => $this->message->content,
                'sender' => $this->message->sender,
                'timestamp' => $this->message->created_at->toIso8601String(),
                'tokens' => $this->message->tokens,
                'response_time' => $this->message->response_time,
                'model' => $this->message->model
            ]
        ];
    }
}