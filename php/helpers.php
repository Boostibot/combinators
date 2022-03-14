<?php
function is_in_array($what, $searched_array)
{
    return array_search($what, $searched_array) !== false;
}

function has_key($array, $key)
{
    return array_key_exists($key, $array);
}

function fallback(...$replacements)
{
    foreach($replacements as $replacement)
    {
        if($replacement)
            return $replacement;
    }

    return end($replacements);
}

function strict_fallback(...$replacements)
{
    foreach($replacements as $replacement)
    {
        if($replacement !== null)
            return $replacement;
    }

    return end($replacements);
}

function fallback_inplace(&$possibly_empty, $replacement)
{
    if(!$possibly_empty)
        $possibly_empty = $replacement;
}

function clamp($what, $range_begin, $range_end )
{
    if($what < $range_begin)
        return $range_begin;
    if($what > $range_end)
        return $range_end;

    return $what;
}

function get_default_key($pair) 
{   
    return $pair[0];
}

function get_default_value($pair) 
{   
    return $pair[1];
}

function create_map_from_array($pairs, $get_key = "get_default_key", $get_value = "get_default_value")
{
    $map = array();
    
    foreach($pairs as $pair) 
        $map[$get_key($pair, $pairs)] = $get_value($pair, $pairs);

    return $map;
}

const DATE_FORMAT = 'j. n. Y';
function transfom_date($date, $format = DATE_FORMAT)
{
    return date($format, strtotime($date));
}

class unique_number 
{
    static int $counter = 0;

    static function generate() 
    {
        return self::$counter++;
    }
}

function get_file_output($file_path) 
{
    ob_start(); 
    include $file_path;
    return ob_get_clean(); 
}

function enforce_array(&$array)
{
    if(gettype($array) != 'array')
        $array = [];
}

const PLOP_INCLUDE = 'include';
const PLOP_REQUIRE = 'require';
const PLOP_INCLUDE_ONCE = 'include_once';
const PLOP_REQUIRE_ONCE = 'require_once';

function plop_action($action, $value)
{
    switch($action) 
    {
        case PLOP_INCLUDE:      return include($value);
        case PLOP_REQUIRE:      return require($value);
        case PLOP_INCLUDE_ONCE: return include_once($value);
        case PLOP_REQUIRE_ONCE: return require_once($value);
    }
    
    return true;
}

function plop_single($content)
{
    if(gettype($content) != "array")
    {
        echo $content;
        return true;
    }

    $return_val = true;
    foreach($content as $action => $value)
    {
        if(plop_action($action, $value) == false)
            $return_val = false;
    }

    return $return_val;
}

function plop_return(...$contents) 
{
    $return_val = true;
    foreach($contents as $content)
    { 
        if(plop_single($content) == false)
            $return_val = false;
    }

    return $return_val;
}

function plop(...$contents) 
{
    foreach($contents as $content)
        plop_single($content);
}

?>